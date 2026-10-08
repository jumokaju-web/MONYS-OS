import test from "node:test";
import assert from "node:assert/strict";
import { reconciliarUtilidadVentas } from "../../src/features/importador/utils/reconciliarUtilidadVentas.js";

function exportacion(totalVenta = "$ 422.31") {
  const encabezados = Array(25).fill("");
  Object.assign(encabezados, {
    0: "Documento",
    3: "Fecha",
    4: "Folio",
    15: "Total Ven.",
    20: "Total Com.",
    24: "Utilidad",
  });
  const ticket = Array(25).fill("");
  Object.assign(ticket, {
    0: "Tickets",
    3: "2026-09-28T10:25:39",
    4: "21095",
    15: totalVenta,
    20: "$ 290.47",
    24: "$ 131.84",
  });
  const total = Array(25).fill("");
  Object.assign(total, {
    9: "Total Ventas:",
    15: "$ 422.31",
    20: "$ 290.47",
    24: "$ 131.84",
  });
  return [encabezados, ticket, total];
}

test("confirma que las sumas de los tickets coinciden con el total SICAR", () => {
  const resultado = reconciliarUtilidadVentas(exportacion(), [
    { ventaTotal: 422.31, costoTotal: 290.47, utilidad: 131.84 },
  ]);
  assert.equal(resultado.estado, "conciliado");
  assert.deepEqual(resultado.diferencias, { venta: 0, costo: 0, utilidad: 0 });
});

test("marca diferencia y conserva importes comparables cuando la lectura no cuadra", () => {
  const resultado = reconciliarUtilidadVentas(exportacion(), [
    { ventaTotal: 400, costoTotal: 290.47, utilidad: 109.53 },
  ]);
  assert.equal(resultado.estado, "diferencia");
  assert.deepEqual(resultado.diferencias, { venta: -22.31, costo: 0, utilidad: -22.31 });
});

test("avisa cuando el archivo no tiene una fila de totales SICAR", () => {
  const filas = exportacion().slice(0, 2);
  const resultado = reconciliarUtilidadVentas(filas, [
    { ventaTotal: 422.31, costoTotal: 290.47, utilidad: 131.84 },
  ]);
  assert.equal(resultado.estado, "sin_control");
});

test("reconcilia los totales SICAR separados en encabezados y fila de importes", () => {
  const encabezados = Array(27).fill("");
  Object.assign(encabezados, {
    0: "Documento",
    3: "Fecha",
    4: "Folio",
    15: "Total Ven.",
    20: "Total Com.",
    24: "Utilidad",
  });
  const ticket = Array(27).fill("");
  Object.assign(ticket, {
    0: "Tickets",
    3: "2026-09-28T10:25:39",
    4: "21095",
    15: "$ 422.31",
    20: "$ 290.47",
    24: "$ 131.84",
  });
  const marcaTotales = Array(27).fill("");
  marcaTotales[11] = "TOTALES";
  const encabezadosTotales = Array(27).fill("");
  Object.assign(encabezadosTotales, { 11: "Ventas", 18: "Compra", 22: "Utilidad" });
  const importesTotales = Array(27).fill("");
  Object.assign(importesTotales, { 11: "$ 422.31", 18: "$ 290.47", 22: "$ 131.84" });

  const resultado = reconciliarUtilidadVentas(
    [encabezados, ticket, marcaTotales, encabezadosTotales, importesTotales],
    [{ ventaTotal: 422.31, costoTotal: 290.47, utilidad: 131.84 }],
  );
  assert.equal(resultado.estado, "conciliado");
  assert.deepEqual(resultado.diferencias, { venta: 0, costo: 0, utilidad: 0 });
});
