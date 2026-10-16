import test from "node:test";
import assert from "node:assert/strict";
import { obtenerEstadoCorte } from "../../src/features/dashboard/utils/estadoCorte.js";

test("no declara cero mientras se consulta el corte", () => {
  assert.equal(
    obtenerEstadoCorte({ cargando: true, fechaInicial: null, fechaFinal: null }),
    "cargando"
  );
});

test("distingue una consulta fallida de un corte con cero movimientos", () => {
  assert.equal(
    obtenerEstadoCorte({ error: true, fechaInicial: "2026-10-05", fechaFinal: "2026-10-11" }),
    "error"
  );
});

test("marca pendiente un corte sin fechas válidas", () => {
  assert.equal(obtenerEstadoCorte(), "sin-periodo");
});

test("permite mostrar cero únicamente cuando el periodo está disponible", () => {
  assert.equal(
    obtenerEstadoCorte({ fechaInicial: "2026-10-05", fechaFinal: "2026-10-11" }),
    "listo"
  );
});
