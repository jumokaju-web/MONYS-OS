import test from "node:test";
import assert from "node:assert/strict";
import { resumirCentroDecisionesFinancieras } from "./centroDecisionesFinancieras.js";

test("prioriza los movimientos pendientes y conserva el conteo real", () => {
  const resumen = resumirCentroDecisionesFinancieras({
    movimientos: [
      { id: "1", estado: "Pendiente de revisión" },
      { id: "2", estado: "Revisado" },
      { id: "3", estado: "Pendiente de revisión" },
    ],
    creditosProveedores: { importacion: { id: "i1" }, saldoTotal: 1200 },
  });

  assert.equal(resumen.pendientes, 2);
  assert.equal(resumen.totalMovimientos, 3);
  assert.equal(resumen.prioridad.destino, "control");
  assert.match(resumen.prioridad.titulo, /2 movimientos pendientes/);
});

test("no convierte datos financieros ausentes en cero", () => {
  const resumen = resumirCentroDecisionesFinancieras({
    movimientos: [],
    datosDashboard: { metricas: {} },
    creditosProveedores: { importacion: null, saldoTotal: 0 },
  });

  assert.equal(resumen.ventas, null);
  assert.equal(resumen.utilidad, null);
  assert.equal(resumen.saldoProveedores, null);
  assert.equal(resumen.prioridad.destino, "importador");
});

test("distingue un saldo confirmado de proveedores igual a cero", () => {
  const resumen = resumirCentroDecisionesFinancieras({
    movimientos: [],
    creditosProveedores: { importacion: { id: "i1" }, saldoTotal: 0 },
    datosDashboard: { metricas: { fechaFinal: "2099-10-20", ventasTotales: 0, utilidadTotal: 0 } },
  });

  assert.equal(resumen.saldoProveedores, 0);
  assert.equal(resumen.ventas, 0);
  assert.equal(resumen.utilidad, 0);
  assert.equal(resumen.prioridad.destino, "disponible");
});
