import test from "node:test";
import assert from "node:assert/strict";
import { generarAnalisisFinanciero } from "../../src/features/inteligencia/ia/directorFinancieroIA.js";
import { generarDecisionCEO } from "../../src/features/inteligencia/ia/ceo/directorGeneralIA.js";
import { directorRHIA } from "../../src/features/inteligencia/directores/directorRHIA.js";

test("flujo positivo sin saldo confirmado no autoriza resurtido ni inventa reserva", () => {
  const financiero = generarAnalisisFinanciero({ movimientos: [
    { movement_type: "ENTRADA", amount: 10000, status: "Revisado", occurred_at: "2026-10-28" },
    { movement_type: "SALIDA", amount: 2000, status: "Revisado", occurred_at: "2026-10-28" },
  ] });
  assert.equal(financiero.flujoNetoTesoreria, 8000);
  assert.equal(financiero.dineroDisponible, null);
  assert.equal(financiero.capacidadCompra, null);
  assert.equal(financiero.reservaRecomendada, null);
  const ceo = generarDecisionCEO({ analisisFinanciero: financiero, analisisInventario: {
    resumen: { inversionSugerida: 1000 }, sugerenciasCompra: [{ codigo: "P1", inversionEstimada: 1000 }],
  } });
  assert.equal(ceo.flujoNetoTesoreria, 8000);
  assert.equal(ceo.dineroDisponible, null);
  assert.equal(ceo.reservaRecomendada, null);
  assert.equal(ceo.capacidadCompra, null);
  assert.equal(ceo.presupuestoCompraAutorizado, 0);
  assert.deepEqual(ceo.comprasAutorizadas, []);
  assert.equal(ceo.estadoLiquidez, "PENDIENTE_VALIDAR_SALDOS");
  const rh = directorRHIA({ analisisFinanciero: financiero });
  assert.equal(rh.dineroDisponible, null);
  assert.equal(rh.reservaRecomendada, null);
});

test("un valor de disponibilidad sin confirmación no habilita compras en dirección", () => {
  const decision = generarDecisionCEO({ analisisFinanciero: { dineroDisponible: 50000, capacidadCompra: 10000 },
    analisisInventario: { resumen: { inversionSugerida: 9000 }, sugerenciasCompra: [{ codigo: "P1", inversionEstimada: 9000 }] } });
  assert.equal(decision.dineroDisponible, null);
  assert.equal(decision.presupuestoCompraAutorizado, 0);
  assert.equal(decision.comprasAutorizadas.length, 0);
});
