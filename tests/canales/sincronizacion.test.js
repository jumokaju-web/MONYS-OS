import test from "node:test";
import assert from "node:assert/strict";
import {
  cuentasParaSincronizar,
  esperaReintento,
  medirCobertura,
  sincronizarCuenta,
  validarVentana,
} from "../../src/core/canales/sincronizacion.js";

const ahora = new Date("2026-11-28T10:00:00Z");
const cuenta = { id: "c1", canal: "mercado_libre", cuenta_externa: "123", estado: "ACTIVA", intentos_fallidos: 0 };
const datos = {
  ordenes: [{ estado: "paid", envio_vendedor: 40, comision: 30 }, { estado: "paid", envio_vendedor: null, comision: 20 }],
  publicaciones: [{ sku: "A" }, { sku: null }],
  liquidaciones: [{ datos_origen: { derivada_de_orden: true } }],
  cobertura: { completa: true },
};

function simulacion({ vigente = true, identidad = "123", fallaGuardarCred = 0, fallaDescarga = false, turnoLibre = true } = {}) {
  const registro = [];
  let fallosCred = fallaGuardarCred;
  let turno = !turnoLibre;
  const proveedor = {
    credencialVigente: () => vigente,
    renovar: async () => { registro.push("renovar"); return { access_token: "nuevo", refresh_token: "r2" }; },
    identidad: async () => identidad,
    descargar: async () => { if (fallaDescarga) throw new Error("timeout de la API"); return datos; },
  };
  const almacen = {
    tomarTurno: async () => { if (turno) return false; turno = true; registro.push("tomarTurno"); return true; },
    liberarTurno: async () => { turno = false; registro.push("liberarTurno"); },
    leerCredencial: async () => ({ access_token: "a", refresh_token: "r1" }),
    guardarCredencial: async () => { if (fallosCred-- > 0) throw new Error("db"); registro.push("guardarCredencial"); },
    guardarDatos: async () => registro.push("guardarDatos"),
    registrarExito: async () => registro.push("registrarExito"),
    registrarFallo: async (_id, info) => registro.push(["registrarFallo", info.intentos, info.proximoIntento, info.critico]),
  };
  return { proveedor, almacen, registro };
}

const opciones = (s, extra = {}) => ({ proveedor: s.proveedor, almacen: s.almacen, desde: "2026-11-01", hasta: "2026-11-27", ahora, ...extra });

test("corrida normal: guarda datos, registra éxito y libera el turno", async () => {
  const s = simulacion();
  const r = await sincronizarCuenta(cuenta, opciones(s));
  assert.equal(r.escrito, true);
  assert.deepEqual(s.registro, ["tomarTurno", "guardarDatos", "registrarExito", "liberarTurno"]);
});

test("dry_run no escribe datos ni estado de la cuenta", async () => {
  const s = simulacion();
  const r = await sincronizarCuenta(cuenta, opciones(s, { dryRun: true }));
  assert.equal(r.escrito, false);
  assert.equal(r.ordenes, 2);
  assert.deepEqual(s.registro, ["tomarTurno", "liberarTurno"]);
  // Con error, dry_run tampoco registra el fallo.
  const f = simulacion({ fallaDescarga: true });
  await sincronizarCuenta(cuenta, opciones(f, { dryRun: true }));
  assert.deepEqual(f.registro, ["tomarTurno", "liberarTurno"]);
});

test("dry_run solo persiste una credencial si la plataforma la rotó", async () => {
  const s = simulacion({ vigente: false });
  const r = await sincronizarCuenta(cuenta, opciones(s, { dryRun: true }));
  assert.equal(r.credencialRotada, true);
  assert.deepEqual(s.registro, ["tomarTurno", "renovar", "guardarCredencial", "liberarTurno"]);
});

test("credencial: se guarda con reintentos antes de usarla; si no se puede, se detiene", async () => {
  const conReintento = simulacion({ vigente: false, fallaGuardarCred: 2 });
  assert.equal((await sincronizarCuenta(cuenta, opciones(conReintento))).escrito, true);
  const perdida = simulacion({ vigente: false, fallaGuardarCred: 5 });
  const r = await sincronizarCuenta(cuenta, opciones(perdida));
  assert.equal(r.critico, true);
  assert.match(r.error, /CREDENCIAL EN RIESGO/);
  assert.ok(!perdida.registro.includes("guardarDatos"));
  assert.equal(perdida.registro.at(-2)[3], true); // fallo crítico registrado
  assert.equal(perdida.registro.at(-1), "liberarTurno");
});

test("turno exclusivo: si otra corrida está en curso, se omite sin tocar nada", async () => {
  const s = simulacion({ turnoLibre: false });
  const r = await sincronizarCuenta(cuenta, opciones(s));
  assert.equal(r.omitida, true);
  assert.deepEqual(s.registro, []);
});

test("identidad distinta a la cuenta registrada: error y nada se guarda", async () => {
  const s = simulacion({ identidad: "999" });
  const r = await sincronizarCuenta(cuenta, opciones(s));
  assert.match(r.error, /pertenece a 999/);
  assert.ok(!s.registro.includes("guardarDatos"));
});

test("error: reintento con espera creciente; la cuenta en ERROR se recupera sola", async () => {
  const s = simulacion({ fallaDescarga: true });
  await sincronizarCuenta({ ...cuenta, intentos_fallidos: 2 }, opciones(s));
  const [, intentos, proximo] = s.registro.find((x) => Array.isArray(x));
  assert.equal(intentos, 3);
  assert.equal(new Date(proximo).getTime() - ahora.getTime(), 60 * 60_000); // 15 × 2²
  assert.equal(esperaReintento(20), 24 * 60 * 60_000);
  const lista = cuentasParaSincronizar([
    { id: "a", estado: "ERROR", proximo_intento: "2026-11-28T09:00:00Z" },
    { id: "b", estado: "ERROR", proximo_intento: "2026-11-28T11:00:00Z" },
    { id: "c", estado: "ACTIVA" },
    { id: "d", estado: "DESCONECTADA" },
  ], ahora);
  assert.deepEqual(lista.map((x) => x.id), ["a", "c"]);
});

test("ventana de fechas validada", () => {
  assert.equal(validarVentana("2026-11-01", "2026-11-27", ahora), null);
  assert.match(validarVentana("2026-01-01", "2026-11-27", ahora), /máxima/);
  assert.match(validarVentana("2026-11-27", "2026-11-01", ahora), /anterior/);
  assert.match(validarVentana("2026-11-01", "2027-01-01", ahora), /futuro/);
  assert.match(validarVentana("ayer", "hoy", ahora), /inválidas/);
});

test("cobertura real por fuente", () => {
  const c = medirCobertura({ ...datos, completa: false, fuentesNoDisponibles: ["retenciones"] });
  assert.deepEqual(c, {
    completa: false, ordenes: 2, ordenesPagadas: 2, enviosConCostoPct: 50, comisionesConocidasPct: 100,
    publicaciones: 2, publicacionesConSkuPct: 50, liquidaciones: 1, liquidacionesDerivadas: 1, fuentesNoDisponibles: ["retenciones"],
  });
});
