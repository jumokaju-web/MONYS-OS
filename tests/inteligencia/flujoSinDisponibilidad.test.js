import test from "node:test";
import assert from "node:assert/strict";
import { generarAnalisisFinanciero } from "../../src/features/inteligencia/ia/directorFinancieroIA.js";
import { generarDecisionCEO } from "../../src/features/inteligencia/ia/ceo/directorGeneralIA.js";
import { directorRHIA } from "../../src/features/inteligencia/directores/directorRHIA.js";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";

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

test("un presupuesto nunca excede el dinero confirmado aunque inventario y capacidad sean mayores", () => {
  const decision = generarDecisionCEO({ analisisFinanciero: { disponibilidadConfirmada: true, dineroDisponible: 1000, capacidadCompra: 10000 },
    analisisInventario: { resumen: { inversionSugerida: 9000 }, sugerenciasCompra: [{ codigo: "P1", inversionEstimada: 9000 }] } });
  assert.equal(decision.presupuestoCompraAutorizado, 1000);
  assert.equal(decision.comprasAutorizadas.length, 0);
});

test("CEO muestra presupuesto por confirmar cuando no hay liquidez comprobada", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { default: Panel } = await server.ssrLoadModule("/src/features/inteligencia/components/PanelCEOIA.jsx");
    const decisionCEO = generarDecisionCEO({ analisisFinanciero: generarAnalisisFinanciero({}) });
    const html = renderToString(React.createElement(Panel, { decisionCEO }));
    assert.match(html, /Presupuesto por confirmar/);
    assert.doesNotMatch(html, /Presupuesto autorizado/);
  } finally { await server.close(); }
});
