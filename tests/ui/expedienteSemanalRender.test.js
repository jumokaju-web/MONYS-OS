import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { resumirExpedienteSemanalFlotilla } from "../../src/features/finanzas/utils/expedienteSemanalFlotilla.js";

test("el cierre no se da por preparado con todas las casillas marcadas si falta evidencia consultada", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const usuario = { auth_user_id: "u1", organization_id: "o1", business_id: "b1", branch_id: "s1", role: "owner" };
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom", plugins: [{
    name: "contexto-prueba", enforce: "pre", load(id) {
      if (id.endsWith("/src/context/UserContext.jsx")) return `export const useUser = () => ({usuario: ${JSON.stringify(usuario)}});`;
    },
  }] });
  const previo = globalThis.window;
  const analisis = { ventasTotales: 10000, costoTotal: 6000, utilidadTotal: 4000, gastosFijos: 1000, gastosVariables: 500, movimientosPendientes: 0, utilidadNetaEstimada: 2500, puntoEquilibrioVentas: 3000 };
  const revision = JSON.stringify([true, 7, 10000, 6000, 4000, 1000, 500, 0, "", null]);
  globalThis.window = { localStorage: { getItem: () => JSON.stringify({ revision, confirmaciones: { ventas: true, caja: true, banco: true, gastos: true, prestamos: true } }) } };
  try {
    const { default: Cierre } = await server.ssrLoadModule("/src/features/inteligencia/components/director-finanzas/CierreSemanalFinanciero.jsx");
    const html = renderToString(React.createElement(Cierre, { metricas: { fechaInicial: "2026-10-19", fechaFinal: "2026-10-25", diasAnalizados: 7 }, analisis, consolidacionValida: true, formatoDinero: String }));
    assert.equal((html.match(/checked=""/g) || []).length, 5);
    assert.match(html, /1 comprobaciones pendientes/);
    assert.match(html, /El cierre sigue pendiente de evidencia/);
    assert.match(html, /Pendiente de completar reportes/);
    assert.doesNotMatch(html, /Base confirmada para revisión final/);
  } finally { globalThis.window = previo; await server.close(); }
});

test("el expediente muestra cobros de servicio anterior y banco observado sin sumarlos a utilidad", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { VistaExpedienteSemanalFlotilla } = await server.ssrLoadModule("/src/features/finanzas/components/ExpedienteSemanalFlotilla.jsx");
    const resumen = resumirExpedienteSemanalFlotilla({ desde: "2026-10-19", hasta: "2026-10-25", facturas: [
      { id: "f1", folio: "DEMO", total: 1160, estado_pago: "PAGADA", pagada_en: "2026-10-23T18:00:00Z", periodo_desde: "2026-10-12", periodo_hasta: "2026-10-18" },
    ], revisionBancaria: { id: "r1", paquete: { movimientos: [{ fecha_operacion: "2026-09-01" }, { fecha_operacion: "2026-09-30" }] } } });
    const html = renderToString(React.createElement(VistaExpedienteSemanalFlotilla, { resumen }));
    assert.match(html, /Cobros registrados en esta semana/);
    assert.match(html, /2026-10-12/);
    assert.match(html, /2026-09-01/);
    assert.match(html, /servicio y cobros por separado/);
    assert.match(html, /no se suman como dos ingresos/);
    assert.match(html, /Pendiente/);
    assert.doesNotMatch(html, /Enlace bancario comprobable/);
  } finally { await server.close(); }
});
