import assert from "node:assert/strict";
import test from "node:test";
import { generarAnalisisFinanciero } from "../../src/features/inteligencia/ia/directorFinancieroIA.js";

test("prioriza confirmar saldos de proveedores cuando SICAR no reporta vencimiento", () => {
  const analisis = generarAnalisisFinanciero({
    ventasTotales: 10000,
    costoTotal: 2000,
    utilidadTotal: 8000,
    margenUtilidad: 80,
    movimientos: [
      {
        movement_type: "ENTRADA",
        amount: 10000,
        status: "Revisado",
        occurred_at: "2026-10-07",
      },
      {
        movement_type: "SALIDA",
        amount: 8500,
        status: "Revisado",
        expense_category: "operacion",
        expense_behavior: "variable",
        occurred_at: "2026-10-07",
      },
    ],
    saldoProveedores: 2400,
    creditosProveedores: [{ saldo: 2400, fecha_vencimiento: null }],
  });

  assert.equal(analisis.saldoProveedoresSinFecha, 2400);
  assert.equal(analisis.proveedoresSinFecha, 1);
  assert.equal(analisis.vencimientos30Dias, 0);
  assert.match(
    analisis.recomendacion,
    /no tiene vencimiento exacto reportado/i,
  );
  assert.match(
    analisis.decisionPrioritaria,
    /confirmar el vencimiento/i,
  );
  assert(
    analisis.accionesPrioritarias.some(
      (accion) => accion.titulo === "Confirmar vencimientos de proveedores",
    ),
  );
});
