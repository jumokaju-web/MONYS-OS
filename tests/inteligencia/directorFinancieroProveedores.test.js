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

test("eleva a prioridad financiera el saldo de proveedores vencido", () => {
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
    saldoProveedores: 1200,
    creditosProveedores: [
      { saldo: 1200, fecha_vencimiento: "2026-10-01" },
    ],
  });

  assert.equal(analisis.saldoProveedoresVencidos, 1200);
  assert.equal(analisis.proveedoresVencidos, 1);
  assert.match(analisis.decisionPrioritaria, /vencimiento anterior a hoy/i);
  assert(
    analisis.accionesPrioritarias.some(
      (accion) =>
        accion.titulo === "Revisar saldos de proveedores vencidos" &&
        accion.prioridad === "ALTA",
    ),
  );
  assert.match(
    analisis.alertasFinancieras.join(" "),
    /ya tiene vencimiento anterior a hoy/i,
  );
});

test("no inventa una reserva monetaria usando solo el flujo neto del periodo", () => {
  const analisis = generarAnalisisFinanciero({
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
  });

  assert.equal(analisis.flujoNetoTesoreria, 1500);
  assert.equal(analisis.reservaRecomendada, null);
  assert(
    !analisis.accionesPrioritarias.some(
      (accion) => accion.titulo === "Proteger reserva de efectivo",
    ),
  );
});
