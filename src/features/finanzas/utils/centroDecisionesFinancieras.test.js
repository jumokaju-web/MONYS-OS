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

test("reconoce una confirmación de cero créditos separada de la importación SICAR", () => {
  const resumen = resumirCentroDecisionesFinancieras({
    movimientos: [],
    creditosProveedores: {
      importacion: null,
      confirmacion: { fecha_corte: "2026-10-15" },
      fuente: "confirmacion_cero",
      disponible: true,
      saldoTotal: 0,
    },
    datosDashboard: { metricas: { fechaFinal: "2099-10-20", ventasTotales: 0, utilidadTotal: 0 } },
  });

  assert.equal(resumen.saldoProveedores, 0);
  assert.notEqual(resumen.prioridad.destino, "importador");
});

test("oculta cifras de una sola sucursal si el corte consolidado no es comparable", () => {
  const resumen = resumirCentroDecisionesFinancieras({
    movimientos: [],
    creditosProveedores: { importacion: { id: "i1" }, saldoTotal: 1200 },
    datosDashboard: {
      metricas: {
        fechaFinal: "2026-10-18",
        ventasTotales: 148711.07,
        utilidadTotal: 59715.16,
      },
    },
    sucursalesDashboard: [
      {
        id: "centro",
        ventasTotales: 114146.14,
        utilidadTotal: 45826.09,
        periodo: { fechaInicial: "2026-10-19", fechaFinal: "2026-10-25" },
      },
      {
        id: "general-anaya",
        ventasTotales: 32959.78,
        utilidadTotal: 13325.99,
        periodo: { fechaInicial: "2026-10-18", fechaFinal: "2026-10-24" },
      },
    ],
  });

  assert.equal(resumen.ventas, null);
  assert.equal(resumen.utilidad, null);
  assert.equal(resumen.fechaFinal, null);
  assert.equal(resumen.alcanceVentas, "Cortes distintos · total pendiente");
  assert.equal(resumen.prioridad.titulo, "Alinear los reportes de las sucursales");
});
