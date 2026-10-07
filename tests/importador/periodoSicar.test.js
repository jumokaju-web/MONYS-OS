import test from "node:test";
import assert from "node:assert/strict";
import { extraerPeriodoSicar, normalizarFechaSicar } from "../../src/features/importador/utils/periodoSicar.js";

test("convierte fechas SICAR en formato mexicano día/mes/año", () => {
  assert.equal(normalizarFechaSicar("28/09/2026"), "2026-09-28");
  assert.equal(normalizarFechaSicar("04-10-2026"), "2026-10-04");
});

test("convierte fechas seriales de Excel", () => {
  assert.equal(normalizarFechaSicar(46300), "2026-10-05");
  assert.equal(normalizarFechaSicar("46300"), "2026-10-05");
});

test("extrae un periodo aunque las fechas vengan como texto", () => {
  assert.deepEqual(extraerPeriodoSicar([
    ["Reporte", "Utilidad"],
    ["Periodo", "28/09/2026", "04/10/2026"],
  ]), { periodoInicio: "2026-09-28", periodoFin: "2026-10-04" });
});

test("rechaza periodos inválidos o invertidos", () => {
  assert.deepEqual(extraerPeriodoSicar([
    ["Periodo", "31/02/2026", "01/03/2026"],
  ]), { periodoInicio: null, periodoFin: null });
  assert.equal(normalizarFechaSicar("not a date"), null);
});
