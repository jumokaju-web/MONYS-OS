import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { consultarTodasLasPaginas } from "../../src/features/tesoreria/utils/paginarConsultaSupabase.js";
import { validarCicloLunesDomingo } from "../../src/features/inteligencia/utils/cicloFinancieroSemanal.js";

const archivo = new URL("../../src/features/finanzas/services/expedienteSemanalFlotillaService.js", import.meta.url);
const usuario = { role: "owner", auth_user_id: "u1", organization_id: "o1", business_id: "b1", branch_id: "s1" };
const periodo = { desde: "2026-10-12", hasta: "2026-10-18" };

function cargar(opciones = {}) {
  const llamadas = [];
  const paginas = {};
  const supabase = {
    auth: { getUser: async () => {
      llamadas.push(["auth"]);
      return opciones.auth || { data: { user: { id: "u1" } }, error: null };
    } },
    from: (tabla) => {
      const pasos = [];
      llamadas.push([tabla, pasos]);
      const cadena = {};
      for (const metodo of ["select", "eq", "in", "order", "limit"]) {
        cadena[metodo] = (...args) => { pasos.push([metodo, ...args]); return cadena; };
      }
      cadena.maybeSingle = async () => {
        pasos.push(["maybeSingle"]);
        return opciones.revision || { data: { id: "r1", organization_id: "o1", business_id: "b1", branch_id: "s1", created_at: "2026-10-20", paquete: { movimientos: [{ id: "banco1" }] } }, error: null };
      };
      cadena.range = async (inicio, fin) => {
        pasos.push(["range", inicio, fin]);
        const contador = paginas[tabla] || 0;
        paginas[tabla] = contador + 1;
        if (tabla === "cash_movements") {
          return opciones.paginasMovimientos?.[contador] || { data: [{ id: "m1", organization_id: "o1", business_id: "flotilla", account_id: "a1", movement_type: "ENTRADA", amount: 1000, status: "Revisado", occurred_at: "2026-10-20" }], error: null };
        }
        const pagina = opciones.paginas?.[contador];
        return pagina || { data: [{ id: "c1", organization_id: "o1", business_id: "b1", branch_id: "s1", estado: "ACTIVA", fecha_banco: "2026-10-20" }], error: null };
      };
      return cadena;
    },
  };
  const obtenerFacturasIngresoFlotillaPeriodo = async (args) => {
    llamadas.push(["facturas", args]);
    if (opciones.errorFacturas) throw new Error("facturas inaccesibles");
    return opciones.facturas || { facturas: [{ id: "f1", organization_id: "o1", business_id: "flotilla", pagada_en: "2026-10-20", movimiento_tesoreria_id: "m1" }], negocioEncontrado: true };
  };
  const fuente = readFileSync(archivo, "utf8")
    .replace(/^import .*;\n/gm, "")
    .replace("export async function obtenerExpedienteSemanalFlotilla", "async function obtenerExpedienteSemanalFlotilla")
    + "\nglobalThis.ejecutar = obtenerExpedienteSemanalFlotilla;";
  const contexto = { supabase, obtenerFacturasIngresoFlotillaPeriodo, consultarTodasLasPaginas, validarCicloLunesDomingo };
  vm.runInNewContext(fuente, contexto, { filename: archivo.pathname });
  return { ejecutar: (args = {}) => contexto.ejecutar({ usuario, ...periodo, ...args }), llamadas };
}

test("rechaza identidad, rol o contexto incompleto antes de consultar fuentes", async () => {
  for (const perfil of [null, { ...usuario, role: "marketing" }, { ...usuario, auth_user_id: null }, { ...usuario, organization_id: null }, { ...usuario, business_id: null }, { ...usuario, branch_id: null }]) {
    const servicio = cargar();
    await assert.rejects(servicio.ejecutar({ usuario: perfil }), /sesión de propietaria/);
    assert.equal(servicio.llamadas.length, 0);
  }
});

test("la identidad autenticada debe coincidir y los errores de sesión bloquean todas las fuentes", async () => {
  for (const auth of [{ data: { user: null }, error: null }, { data: { user: { id: "otra" } }, error: null }, { data: { user: { id: "u1" } }, error: { message: "sesión vencida" } }]) {
    const servicio = cargar({ auth });
    await assert.rejects(servicio.ejecutar(), /sesión cambió/);
    assert.deepEqual(servicio.llamadas.map((llamada) => llamada[0]), ["auth"]);
  }
});

test("rechaza fechas inválidas, marcas de tiempo y cortes distintos de lunes a domingo", async () => {
  for (const fechas of [{ desde: "2026-02-30", hasta: "2026-03-08" }, { desde: "2026-10-12T00:00:00Z" }, { desde: "2026-10-13" }, { hasta: "2026-10-25" }, { desde: "2026-10-19" }, { desde: "" }]) {
    const servicio = cargar();
    await assert.rejects(servicio.ejecutar(fechas), /fecha|corte|semana/i);
    assert.equal(servicio.llamadas.length, 0);
  }
});

test("carga facturas por servicio o cobro y únicamente la última revisión de la propietaria y su contexto", async () => {
  const servicio = cargar();
  const resultado = await servicio.ejecutar();
  const entradaFacturas = servicio.llamadas.find(([tipo]) => tipo === "facturas")[1];
  assert.equal(entradaFacturas.organizationId, "o1");
  assert.equal(entradaFacturas.criterio, "servicio_o_cobro");
  assert.equal(entradaFacturas.desde, periodo.desde);
  assert.equal(entradaFacturas.hasta, periodo.hasta);
  const revision = servicio.llamadas.find(([tipo]) => tipo === "revisiones_bancarias")[1];
  for (const [campo, valor] of Object.entries({ organization_id: "o1", business_id: "b1", branch_id: "s1", created_by: "u1" })) {
    assert.ok(revision.some((paso) => paso[0] === "eq" && paso[1] === campo && paso[2] === valor));
  }
  assert.ok(revision.some((paso) => paso[0] === "order" && paso[1] === "created_at" && paso[2].ascending === false));
  assert.ok(revision.some((paso) => paso[0] === "limit" && paso[1] === 1));
  assert.equal(resultado.facturas[0].id, "f1");
  assert.equal(resultado.negocioEncontrado, true);
  assert.equal(resultado.revisionBancaria.id, "r1");
  assert.equal(resultado.revisionBancaria.organization_id, "o1");
  assert.ok(revision.some((paso) => paso[0] === "select" && paso[1].includes("organization_id,business_id,branch_id")));
});

test("pagina conciliaciones activas de la misma revisión y contexto sin filtrar la fecha bancaria por la semana de servicio", async () => {
  const pagina1 = Array.from({ length: 1000 }, (_, indice) => ({ id: `c${indice}`, fecha_banco: "2026-10-20" }));
  const servicio = cargar({ paginas: [{ data: pagina1, error: null }, { data: [{ id: "ultima", fecha_banco: "2026-10-21" }], error: null }] });
  const resultado = await servicio.ejecutar();
  assert.equal(resultado.conciliaciones.length, 1001);
  assert.equal(resultado.conciliaciones.at(-1).id, "ultima");
  const consultas = servicio.llamadas.filter(([tipo]) => tipo === "conciliaciones_bancarias");
  assert.equal(consultas.length, 2);
  for (const [, pasos] of consultas) {
    for (const [campo, valor] of Object.entries({ organization_id: "o1", business_id: "b1", branch_id: "s1", revision_bancaria_id: "r1", estado: "ACTIVA" })) {
      assert.ok(pasos.some((paso) => paso[0] === "eq" && paso[1] === campo && paso[2] === valor));
    }
    assert.ok(!pasos.some((paso) => ["gte", "lte"].includes(paso[0]) || paso[0] === "eq" && paso[1] === "fecha_banco"));
    assert.ok(pasos.some((paso) => paso[0] === "order" && paso[1] === "id"));
    assert.ok(pasos.some((paso) => paso[0] === "select" && paso[1].includes("organization_id,business_id,branch_id")));
  }
  assert.deepEqual(consultas.map(([, pasos]) => pasos.find(([metodo]) => metodo === "range").slice(1)), [[0, 999], [1000, 1999]]);
});

test("no confunde ausencia de revisión guardada con un error y no consulta conciliaciones sin revisión", async () => {
  const servicio = cargar({ revision: { data: null, error: null } });
  const resultado = await servicio.ejecutar();
  assert.equal(resultado.revisionBancaria, null);
  assert.equal(resultado.conciliaciones.length, 0);
  assert.equal(resultado.facturas.length, 1);
  assert.ok(!servicio.llamadas.some(([tipo]) => tipo === "conciliaciones_bancarias"));
  assert.equal(resultado.movimientosTesoreria[0].id, "m1");
});

test("negocio de Flotilla no identificado permanece explícito", async () => {
  const servicio = cargar({ facturas: { facturas: [], negocioEncontrado: false } });
  const resultado = await servicio.ejecutar();
  assert.equal(resultado.negocioEncontrado, false);
  assert.equal(resultado.facturas.length, 0);
  assert.equal(resultado.movimientosTesoreria.length, 0);
  assert.ok(!servicio.llamadas.some(([tipo]) => tipo === "cash_movements"));
});

test("consulta los movimientos actuales por IDs únicos de facturas con alcance de organización sin exigir el negocio de la pantalla", async () => {
  const facturas = Array.from({ length: 205 }, (_, id) => ({ id: `f${id}`, movimiento_tesoreria_id: `m${id}` }));
  facturas.push({ id: "duplicada", movimiento_tesoreria_id: "m0" }, { id: "sin-id", movimiento_tesoreria_id: null });
  const servicio = cargar({ facturas: { facturas, negocioEncontrado: true } });
  const resultado = await servicio.ejecutar();
  assert.equal(resultado.movimientosTesoreria.length, 3);
  const consultas = servicio.llamadas.filter(([tipo]) => tipo === "cash_movements");
  assert.equal(consultas.length, 3);
  assert.deepEqual(consultas.map(([, pasos]) => pasos.find(([metodo]) => metodo === "in")[2].length), [100, 100, 5]);
  for (const [, pasos] of consultas) {
    assert.ok(pasos.some((paso) => paso[0] === "select" && paso[1] === "id,organization_id,business_id,account_id,movement_type,amount,status,occurred_at"));
    assert.ok(pasos.some((paso) => paso[0] === "eq" && paso[1] === "organization_id" && paso[2] === "o1"));
    assert.ok(!pasos.some((paso) => paso[0] === "eq" && paso[1] === "business_id"));
    assert.ok(pasos.some((paso) => paso[0] === "order" && paso[1] === "id" && paso[2].ascending === true));
    assert.ok(pasos.some((paso) => paso[0] === "range" && paso[1] === 0 && paso[2] === 999));
  }
  const idsConsultados = consultas.flatMap(([, pasos]) => pasos.find(([metodo]) => metodo === "in")[2]);
  assert.equal(new Set(idsConsultados).size, 205);
  assert.equal(idsConsultados.length, 205);
});

test("facturas sin movimiento vinculado no disparan consultas de Tesorería ni crean movimientos ficticios", async () => {
  const servicio = cargar({ facturas: { facturas: [{ id: "f1" }, { id: "f2", movimiento_tesoreria_id: "" }], negocioEncontrado: true } });
  const resultado = await servicio.ejecutar();
  assert.equal(resultado.movimientosTesoreria.length, 0);
  assert.ok(!servicio.llamadas.some(([tipo]) => tipo === "cash_movements"));
});

test("pagina movimientos vigentes y propaga errores de una página posterior", async () => {
  const primera = Array.from({ length: 1000 }, (_, id) => ({ id: `m${id}`, organization_id: "o1", business_id: "flotilla" }));
  const servicio = cargar({ paginasMovimientos: [{ data: primera, error: null }, { data: [{ id: "ultimo" }], error: null }] });
  const resultado = await servicio.ejecutar();
  assert.equal(resultado.movimientosTesoreria.length, 1001);
  const rangos = servicio.llamadas.filter(([tipo]) => tipo === "cash_movements").map(([, pasos]) => pasos.find(([metodo]) => metodo === "range").slice(1));
  assert.deepEqual(rangos, [[0, 999], [1000, 1999]]);
  await assert.rejects(cargar({ paginasMovimientos: [{ data: primera, error: null }, { data: null, error: { message: "movimientos segunda página" } }] }).ejecutar(), /movimientos segunda página/);
});

test("fallos en cualquiera de las fuentes rechazan el expediente en vez de reportar ceros", async () => {
  const escenarios = [
    [{ errorFacturas: true }, /facturas inaccesibles/],
    [{ facturas: { facturas: null, negocioEncontrado: true } }, /No se confirmó/],
    [{ revision: { data: null, error: { message: "permisos revisión" } } }, /permisos revisión/],
    [{ revision: { data: {}, error: null } }, /identidad válida/],
    [{ paginas: [{ data: null, error: { message: "permisos conciliaciones" } }] }, /permisos conciliaciones/],
    [{ paginas: [{ data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }, { data: null, error: { message: "falló segunda página" } }] }, /segunda página/],
    [{ paginasMovimientos: [{ data: null, error: { message: "movimientos inaccesibles" } }] }, /movimientos inaccesibles/],
  ];
  for (const [opciones, mensaje] of escenarios) await assert.rejects(cargar(opciones).ejecutar(), mensaje);
});
