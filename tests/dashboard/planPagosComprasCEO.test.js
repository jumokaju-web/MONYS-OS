import test from "node:test";
import assert from "node:assert/strict";
import { construirPlanPagosCompras, simularPlanPagosCompras } from "../../src/features/dashboard/utils/planPagosComprasCEO.js";

const base = {
  hoy: "2026-10-15",
  deudasConsultadas: true,
  creditosProveedores: { fuenteCompleta: true, creditos: [] },
  disponibilidad: { hoy: "2026-10-15", calculable: true, liquidezLocalizada: 10000 },
  compraConsultada: true,
  compraMaestra: { inversionTotal: 2000 },
};

test("separa vencidos y agrupa compromisos reales en 13 semanas", () => {
    const plan = construirPlanPagosCompras({
      ...base,
      creditosProveedores: {
        fuenteCompleta: true,
        creditos: [
          { id: "a", nombre: "Anterior", saldo: 500, fecha_vencimiento: "2026-10-14" },
          { id: "b", nombre: "Semana uno", saldo: 1000, fecha_vencimiento: "2026-10-18" },
          { id: "c", nombre: "Semana dos", saldo: 700, fecha_vencimiento: "2026-10-25" },
        ],
      },
    });

  assert.equal(plan.totalVencido, 500);
  assert.equal(plan.semanas[0].total, 1000);
  assert.equal(plan.semanas[1].total, 700);
  assert.equal(plan.total13Semanas, 2200);
});

test("no convierte una obligación sin fecha o importe en cero", () => {
    const plan = construirPlanPagosCompras({
      ...base,
      deudas: [{ id: "x", estado: "ACTIVA", acreedor: "Banco", saldo_actual: 9000, pago_mensual: null, fecha_proximo_pago: null }],
    });

  assert.equal(plan.incompletas.length, 1);
  assert.equal(plan.calendarioCompleto, false);
  assert.equal(simularPlanPagosCompras(plan).saldoFinal, null);
});

test("bloquea el escenario cuando la liquidez no está confirmada", () => {
    const plan = construirPlanPagosCompras({
      ...base,
      disponibilidad: { hoy: "2026-10-15", calculable: false, liquidezLocalizada: 10000 },
    });

  assert.equal(simularPlanPagosCompras(plan).calculable, false);
});

test("resta pagos, compra y reserva una sola vez", () => {
    const plan = construirPlanPagosCompras({
      ...base,
      deudas: [{ id: "d", estado: "ACTIVA", acreedor: "Banco", pago_mensual: 1500, fecha_proximo_pago: "2026-10-20" }],
      creditosProveedores: {
        fuenteCompleta: true,
        creditos: [{ id: "p", nombre: "Proveedor", saldo: 500, fecha_vencimiento: "2026-10-10" }],
      },
    });
    const escenario = simularPlanPagosCompras(plan, { horizonte: "7", incluirCompra: true, reserva: 1000 });

  assert.equal(escenario.pagos, 2000);
  assert.equal(escenario.saldoFinal, 5000);
  assert.equal(escenario.maximoCompra, 7000);
  assert.equal(escenario.estado, "viable");
});

test("una fecha imposible queda pendiente en lugar de entrar al calendario", () => {
  const plan = construirPlanPagosCompras({
    ...base,
    creditosProveedores: {
      fuenteCompleta: true,
      creditos: [{ id: "p", nombre: "Proveedor", saldo: 500, fecha_vencimiento: "2026-02-31" }],
    },
  });

  assert.equal(plan.incompletas.length, 1);
  assert.equal(plan.programadas.length, 0);
  assert.equal(plan.calendarioCompleto, false);
});

test("marca déficit cuando la decisión dejaría caja negativa", () => {
    const plan = construirPlanPagosCompras({ ...base, compraMaestra: { inversionTotal: 12000 } });
    const escenario = simularPlanPagosCompras(plan, { incluirCompra: true });

  assert.equal(escenario.saldoFinal, -2000);
  assert.equal(escenario.estado, "deficit");
});
