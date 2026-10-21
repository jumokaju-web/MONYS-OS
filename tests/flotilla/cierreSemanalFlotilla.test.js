import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluarCierreSemanal,
  periodoPrefacturaSugerido,
  semanaOperativa,
  separarRutasPorCierre,
} from "../../src/features/flotilla/utils/cierreSemanalFlotilla.js";

test("la semana operativa siempre va de lunes a domingo", () => {
  assert.deepEqual(semanaOperativa("2026-10-21"), { desde: "2026-10-19", hasta: "2026-10-25" });
  assert.deepEqual(semanaOperativa("2026-10-25"), { desde: "2026-10-19", hasta: "2026-10-25" });
});

test("el domingo sugiere la semana actual y el lunes la semana recién cerrada", () => {
  assert.deepEqual(periodoPrefacturaSugerido("2026-10-25"), { desde: "2026-10-19", hasta: "2026-10-25" });
  assert.deepEqual(periodoPrefacturaSugerido("2026-10-26"), { desde: "2026-10-19", hasta: "2026-10-25" });
  assert.deepEqual(periodoPrefacturaSugerido("2026-10-21"), { desde: "2026-10-12", hasta: "2026-10-18" });
});

test("una ruta abierta queda fuera del corte pagable", () => {
  const rutas = [
    { id: "cerrada", estado: "FINALIZADA", hora_fin_ruta: "2026-10-18T22:00:00Z" },
    { id: "abierta", estado: "EN_RUTA", hora_fin_ruta: null },
  ];
  const separadas = separarRutasPorCierre(rutas);
  assert.deepEqual(separadas.finalizadas.map((item) => item.id), ["cerrada"]);
  assert.deepEqual(separadas.pendientes.map((item) => item.id), ["abierta"]);
});

test("un reintento abierto no bloquea una ruta que sí terminó", () => {
  const base = { fecha: "2026-10-18", unidad_id: "u1", driver_auth_user_id: "d1", codigo_ruta: "Q4" };
  const separadas = separarRutasPorCierre([
    { ...base, id: "intento", estado: "EN_RUTA", hora_inicio_ruta: "2026-10-18T13:00:00Z" },
    { ...base, id: "real", estado: "FINALIZADA", hora_inicio_ruta: "2026-10-18T13:00:05Z", hora_fin_ruta: "2026-10-18T20:00:00Z" },
  ]);
  assert.deepEqual(separadas.finalizadas.map((item) => item.id), ["real"]);
  assert.equal(separadas.pendientes.length, 0);
  assert.deepEqual(separadas.duplicadasIgnoradas.map((item) => item.id), ["intento"]);
});

test("la semana sólo queda lista cuando terminó y todas las rutas están cerradas", () => {
  const periodo = { desde: "2026-10-12", hasta: "2026-10-18" };
  const cerrada = { estado: "FINALIZADA", hora_fin_ruta: "2026-10-18T22:00:00Z" };
  assert.equal(evaluarCierreSemanal([cerrada], periodo, "2026-10-19").estado, "LISTA_REVISION");
  assert.equal(evaluarCierreSemanal([{ estado: "EN_RUTA" }], periodo, "2026-10-19").estado, "PENDIENTE_CIERRES");
  assert.equal(evaluarCierreSemanal([cerrada], { desde: "2026-10-13", hasta: "2026-10-18" }, "2026-10-19").estado, "PERIODO_INCOMPLETO");
});
