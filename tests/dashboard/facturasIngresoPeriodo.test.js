import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { consultarTodasLasPaginas } from "../../src/features/tesoreria/utils/paginarConsultaSupabase.js";

const fuente = readFileSync(new URL(
  "../../src/features/dashboard/services/facturasIngresoFlotillaService.js", import.meta.url,
), "utf8").replace(/^import .*;$/gm, "").replace("export async function", "async function");

// Generic in-memory PostgREST query double. Record every filter and apply it to
// realistic rows so omissions in org/business/date/status scope are observable.
function separarGrupos(texto) {
  let profundidad = 0;
  let inicio = 0;
  const partes = [];
  for (let i = 0; i < texto.length; i += 1) {
    if (texto[i] === "(") profundidad += 1;
    if (texto[i] === ")") profundidad -= 1;
    if (texto[i] === "," && profundidad === 0) { partes.push(texto.slice(inicio, i)); inicio = i + 1; }
  }
  partes.push(texto.slice(inicio));
  return partes;
}

function comparar(fila, campo, operador, valor) {
  let real = fila[campo];
  let esperado = valor;
  if (campo === "pagada_en") {
    if (!real) return false;
    real = Date.parse(real);
    esperado = Date.parse(valor);
  }
  switch (operador) {
    case "eq": return real === esperado;
    case "neq": return real !== esperado;
    case "gte": return real >= esperado;
    case "lte": return real <= esperado;
    case "lt": return real < esperado;
    default: throw new Error(`Operador inesperado: ${operador}`);
  }
}

function evaluarExpresion(fila, expresion) {
  if (expresion.startsWith("and(")) {
    return separarGrupos(expresion.slice(4, -1)).every((parte) => evaluarExpresion(fila, parte));
  }
  const [, campo, operador, valor] = /^(\w+)\.(eq|neq|gte|lte|lt)\.(.+)$/.exec(expresion) || [];
  assert.ok(campo, `Expresión no válida: ${expresion}`);
  return comparar(fila, campo, operador, valor);
}

function preparar({ facturas = [], negocios = [{ id: "flotilla-1", name: "Imperpaq Flotilla", organization_id: "org-1", active: true }],
  errorNegocios = null, errorFacturas = null } = {}) {
  const consultas = [];
  const supabase = { from(tabla) {
    const registro = { tabla, filtros: [], orden: [], rango: null };
    consultas.push(registro);
    const condiciones = [];
    const consulta = {
      select() { return this; },
      order(campo, opciones) { registro.orden.push([campo, opciones]); return this; },
      or(expresion) {
        registro.filtros.push(["or", expresion]);
        condiciones.push((fila) => separarGrupos(expresion).some((parte) => evaluarExpresion(fila, parte)));
        return this;
      },
      range(primero, ultimo) { registro.rango = [primero, ultimo]; return Promise.resolve(resultado()); },
      then(resolve, reject) { return Promise.resolve(resultado()).then(resolve, reject); },
    };
    for (const operador of ["eq", "neq", "gte", "lte", "lt"]) consulta[operador] = (campo, valor) => {
      registro.filtros.push([operador, campo, valor]);
      condiciones.push((fila) => comparar(fila, campo, operador, valor));
      return consulta;
    };
    function resultado() {
      const error = tabla === "businesses" ? errorNegocios : errorFacturas;
      if (error) return { data: null, error };
      let filas = (tabla === "businesses" ? negocios : facturas).filter((fila) => condiciones.every((predicado) => predicado(fila)));
      for (const [campo] of [...registro.orden].reverse()) filas = [...filas].sort((a, b) => String(a[campo]).localeCompare(String(b[campo])));
      if (registro.rango) filas = filas.slice(registro.rango[0], registro.rango[1] + 1);
      return { data: filas, error: null };
    }
    return consulta;
  } };
  const contexto = { supabase, consultarTodasLasPaginas };
  vm.createContext(contexto);
  vm.runInContext(`${fuente}\nthis.obtener = obtenerFacturasIngresoFlotillaPeriodo;`, contexto);
  return { consultas, obtener: contexto.obtener };
}

const factura = (cambios = {}) => ({
  id: "factura-1", organization_id: "org-1", business_id: "flotilla-1",
  periodo_desde: "2026-10-12", periodo_hasta: "2026-10-18", estado_pago: "PAGADA",
  pagada_en: "2026-10-22T15:00:00Z", total: 12575, ...cambios,
});
const periodoServicio = { organizationId: "org-1", desde: "2026-10-12", hasta: "2026-10-18" };
const periodoCobro = { organizationId: "org-1", desde: "2026-10-19", hasta: "2026-10-25" };
const ids = (resultado) => resultado.facturas.map((fila) => fila.id);

test("Flotilla reconoce servicio en su semana y cobro en la posterior sin duplicar factura", async () => {
  const caso = preparar({ facturas: [factura()] });
  assert.deepEqual(ids(await caso.obtener(periodoServicio)), ["factura-1"]);
  assert.deepEqual(ids(await caso.obtener({ ...periodoServicio, criterio: "cobro" })), []);
  assert.deepEqual(ids(await caso.obtener({ ...periodoCobro, criterio: "servicio" })), []);
  assert.deepEqual(ids(await caso.obtener({ ...periodoCobro, criterio: "cobro" })), ["factura-1"]);
  assert.deepEqual(ids(await caso.obtener({ ...periodoCobro, criterio: "servicio_o_cobro" })), ["factura-1"]);
});

test("Flotilla el criterio combinado devuelve una sola vez la factura con servicio y cobro en el mismo corte", async () => {
  const caso = preparar({ facturas: [factura({ pagada_en: "2026-10-18T19:00:00Z" })] });
  const resultado = await caso.obtener({ ...periodoServicio, criterio: "servicio_o_cobro" });
  assert.deepEqual(ids(resultado), ["factura-1"]);
  assert.equal(resultado.negocioEncontrado, true);
});

test("Flotilla usa medianoche México y límite final exclusivo para cobros", async () => {
  const caso = preparar({ facturas: [
    factura({ id: "antes", pagada_en: "2026-10-19T05:59:59.999Z" }),
    factura({ id: "inicio", pagada_en: "2026-10-19T06:00:00.000Z" }),
    factura({ id: "ultimo", pagada_en: "2026-10-26T05:59:59.999Z" }),
    factura({ id: "siguiente", pagada_en: "2026-10-26T06:00:00.000Z" }),
  ] });
  assert.deepEqual(ids(await caso.obtener({ ...periodoCobro, criterio: "cobro" })), ["inicio", "ultimo"]);
  const consulta = caso.consultas.find((item) => item.tabla === "flotilla_facturas_ingreso");
  assert.ok(consulta.filtros.some((filtro) => filtro.join("|") === "gte|pagada_en|2026-10-19T00:00:00-06:00"));
  assert.ok(consulta.filtros.some((filtro) => filtro.join("|") === "lt|pagada_en|2026-10-26T00:00:00-06:00"));
});

test("Flotilla convierte instantes UTC del filtro al día México", async () => {
  const caso = preparar({ facturas: [factura()] });
  await caso.obtener({ organizationId: "org-1", desde: "2026-10-20T02:00:00Z", hasta: "2026-10-26T05:59:59Z", criterio: "cobro" });
  const consulta = caso.consultas.find((item) => item.tabla === "flotilla_facturas_ingreso");
  assert.ok(consulta.filtros.some((filtro) => filtro.join("|") === "gte|pagada_en|2026-10-19T00:00:00-06:00"));
  assert.ok(consulta.filtros.some((filtro) => filtro.join("|") === "lt|pagada_en|2026-10-26T00:00:00-06:00"));
});

for (const criterio of ["servicio", "cobro", "servicio_o_cobro"]) {
  test(`Flotilla limita organización y negocio, excluye canceladas y no pagadas del cobro (${criterio})`, async () => {
    const caso = preparar({ facturas: [
      factura({ id: "valida" }),
      factura({ id: "otra-organizacion", organization_id: "org-2" }),
      factura({ id: "otro-negocio", business_id: "tienda-1" }),
      factura({ id: "cancelada", estado_pago: "CANCELADA" }),
      factura({ id: "pendiente", estado_pago: "PENDIENTE", pagada_en: "2026-10-22T15:00:00Z", periodo_desde: "2026-10-01", periodo_hasta: "2026-10-07" }),
    ], negocios: [
      { id: "flotilla-1", name: "Flotilla", organization_id: "org-1", active: true },
      { id: "flotilla-ajena", name: "Flotilla", organization_id: "org-2", active: true },
      { id: "flotilla-inactiva", name: "Flotilla", organization_id: "org-1", active: false },
    ] });
    const periodo = criterio === "servicio" ? periodoServicio : periodoCobro;
    assert.deepEqual(ids(await caso.obtener({ ...periodo, criterio })), ["valida"]);
    const consulta = caso.consultas.find((item) => item.tabla === "flotilla_facturas_ingreso");
    assert.ok(consulta.filtros.some((filtro) => filtro.join("|") === "eq|organization_id|org-1"));
    assert.ok(consulta.filtros.some((filtro) => filtro.join("|") === "eq|business_id|flotilla-1"));
    assert.ok(consulta.filtros.some((filtro) => filtro.join("|") === "neq|estado_pago|CANCELADA"));
  });
}

test("Flotilla carga más de 1000 facturas con paginación y orden estable", async () => {
  const caso = preparar({ facturas: Array.from({ length: 2005 }, (_, indice) => factura({ id: `factura-${String(indice).padStart(4, "0")}` })) });
  const resultado = await caso.obtener(periodoServicio);
  assert.equal(resultado.facturas.length, 2005);
  assert.equal(new Set(ids(resultado)).size, 2005);
  const paginas = caso.consultas.filter((item) => item.tabla === "flotilla_facturas_ingreso");
  assert.deepEqual(paginas.map((item) => item.rango), [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.ok(paginas.every((item) => item.orden.map(([campo]) => campo).join() === "periodo_desde,id"));
});

test("Flotilla propaga error de consulta sin convertirlo en lista vacía exitosa", async () => {
  const error = { message: "consulta denegada", code: "42501" };
  const caso = preparar({ errorFacturas: error });
  await assert.rejects(caso.obtener(periodoServicio), (recibido) => recibido === error);
});

test("Flotilla informa error al localizar el negocio", async () => {
  const caso = preparar({ errorNegocios: { message: "sin conexión" } });
  await assert.rejects(caso.obtener(periodoServicio), /No fue posible localizar Flotilla: sin conexión/);
  assert.equal(caso.consultas.length, 1);
});

test("Flotilla no mezcla negocios cuando hay dos candidatos activos", async () => {
  const caso = preparar({ negocios: [
    { id: "flotilla-1", name: "Flotilla Centro", organization_id: "org-1", active: true },
    { id: "flotilla-2", name: "Flotilla Anaya", organization_id: "org-1", active: true },
  ] });
  const resultado = await caso.obtener(periodoServicio);
  assert.equal(resultado.negocioEncontrado, false);
  assert.equal(resultado.facturas.length, 0);
  assert.equal(caso.consultas.length, 1);
});

test("Flotilla rechaza criterio desconocido y evita consultas con rango inverso", async () => {
  const caso = preparar();
  await assert.rejects(caso.obtener({ ...periodoServicio, criterio: "inventado" }), /criterio de fechas/);
  const resultado = await caso.obtener({ ...periodoServicio, desde: "2026-10-20" });
  assert.equal(resultado.negocioEncontrado, false);
  assert.equal(caso.consultas.length, 0);
});

for (const fechaInvalida of ["2026-13-01", "2026-02-31"]) {
  for (const campo of ["desde", "hasta"]) {
    test(`Flotilla rechaza fecha calendario inválida en ${campo}: ${fechaInvalida}`, async () => {
      const caso = preparar();
      const resultado = await caso.obtener({ ...periodoServicio, [campo]: fechaInvalida });
      assert.equal(resultado.negocioEncontrado, false);
      assert.equal(resultado.facturas.length, 0);
      assert.equal(caso.consultas.length, 0);
    });
  }
}
