import test from "node:test";
import assert from "node:assert/strict";
import { evaluarComparabilidadPeriodos } from "../../src/features/dashboard/utils/evaluarComparabilidadPeriodos.js";

test("permite comparar reportes del mismo periodo", () => {
  const periodo = { fechaInicial: "2026-09-28", fechaFinal: "2026-10-04" };
  assert.equal(evaluarComparabilidadPeriodos(periodo, periodo, true).comparable, true);
});

test("pausa comparación cuando SICAR reporta periodos distintos", () => {
  const ventas = { fechaInicial: "2026-09-22", fechaFinal: "2026-10-05" };
  const utilidad = { fechaInicial: "2026-09-28", fechaFinal: "2026-10-04" };
  const resultado = evaluarComparabilidadPeriodos(ventas, utilidad, true);
  assert.equal(resultado.comparable, false);
  assert.match(resultado.mensaje, /Comparación de productos pausada/);
});

test("no bloquea si solo está disponible un reporte", () => {
  assert.equal(evaluarComparabilidadPeriodos(null, null, false).comparable, true);
});
