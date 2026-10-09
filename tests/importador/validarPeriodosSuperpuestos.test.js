import test from "node:test";
import assert from "node:assert/strict";
import { validarPeriodosSuperpuestos } from "../../src/features/importador/utils/validarPeriodosSuperpuestos.js";

const archivo = (nombre, tipoReporte, inicio, fin) => ({
  nombre,
  tipoReporte,
  datosNormalizados: [{ periodoInicio: inicio, periodoFin: fin }],
});

test("detiene dos cortes del mismo reporte con fechas superpuestas", () => {
  const error = validarPeriodosSuperpuestos([
    archivo("SICAR semanal.xlsx", "Utilidad de ventas", "2026-09-28", "2026-10-04"),
    archivo("SICAR quincenal.xlsx", "Utilidad de ventas", "2026-09-22", "2026-10-05"),
  ]);
  assert.match(error, /se traslapan/);
  assert.match(error, /no suma ambos/);
});

test("permite periodos consecutivos sin traslape", () => {
  assert.equal(validarPeriodosSuperpuestos([
    archivo("Corte 1.xlsx", "Utilidad de ventas", "2026-09-21", "2026-09-27"),
    archivo("Corte 2.xlsx", "Utilidad de ventas", "2026-09-28", "2026-10-04"),
  ]), null);
});

test("permite reportes de tipos distintos aunque tengan el mismo periodo", () => {
  assert.equal(validarPeriodosSuperpuestos([
    archivo("Ventas por artículo.xlsx", "Ventas por artículo", "2026-09-28", "2026-10-04"),
    archivo("Utilidad de ventas.xlsx", "Utilidad de ventas", "2026-09-28", "2026-10-04"),
  ]), null);
});

test("ignora archivos sin fechas de periodo detectables", () => {
  assert.equal(validarPeriodosSuperpuestos([
    { nombre: "sin periodo.xlsx", tipoReporte: "Utilidad de ventas", datosNormalizados: [] },
  ]), null);
});
