import test from "node:test";
import assert from "node:assert/strict";
import { resumirCorteFinancieroDireccion } from "../../src/features/dashboard/utils/resumenFinancieroDireccion.js";

const sucursales = [
  { id: "centro", ventasTotales: 114146.14, utilidadTotal: 45826.09, periodo: { fechaInicial: "2026-10-19", fechaFinal: "2026-10-25" } },
  { id: "anaya", ventasTotales: 32959.78, utilidadTotal: 13325.99, periodo: { fechaInicial: "2026-10-19", fechaFinal: "2026-10-25" } },
];

test("consolida finanzas de ambas sucursales cuando usan el mismo corte", () => {
  const corte = resumirCorteFinancieroDireccion(sucursales);
  assert.equal(corte.disponible, true);
  assert.equal(corte.ventas, 147105.92);
  assert.equal(corte.utilidad, 59152.08);
  assert.equal(corte.fechaInicial, "2026-10-19");
  assert.equal(corte.fechaFinal, "2026-10-25");
});

test("bloquea cifras parciales y fechas cuando los cortes de sucursal difieren", () => {
  const corte = resumirCorteFinancieroDireccion([
    sucursales[0],
    { ...sucursales[1], periodo: { fechaInicial: "2026-10-12", fechaFinal: "2026-10-18" } },
  ]);
  assert.equal(corte.disponible, false);
  assert.equal(corte.ventas, null);
  assert.equal(corte.utilidad, null);
  assert.equal(corte.fechaFinal, null);
  assert.match(corte.motivo, /periodos.*distintos/i);
});
