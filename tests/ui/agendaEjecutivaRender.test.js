import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
import { generarDecisionCEO } from "../../src/features/inteligencia/ia/ceo/directorGeneralIA.js";

test("la agenda muestra todas las propuestas por área y advierte si hay más de tres críticas", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { default: Agenda } = await server.ssrLoadModule("/src/features/inteligencia/components/AgendaEjecutivaConsejo.jsx");
    const prioridades = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, titulo: `Propuesta visible ${i}`, descripcion: `Evidencia ${i}`, director: i % 2 ? "financiero" : "marketing", prioridad: i < 5 ? "CRITICA" : "MEDIA" }));
    const html = renderToString(React.createElement(Agenda, { prioridades }));
    for (const p of prioridades) assert(html.includes(p.titulo));
    assert.match(html, /Hay <!-- -->5<!-- --> propuestas críticas/);
    assert.match(html, /Filtrar agenda por área/);
    assert.match(html, /Agenda completa/);
    assert.match(html, /no delega automáticamente/);
    const { default: Panel } = await server.ssrLoadModule("/src/features/inteligencia/components/PanelCEOIA.jsx");
    const decisionCEO = generarDecisionCEO({ analisisFinanciero: { agendaCompleta: prioridades } });
    const panel = renderToString(React.createElement(Panel, { decisionCEO }));
    assert.match(panel, /Ver agenda ejecutiva completa/);
    assert(panel.includes("Propuesta visible 11"));
    assert.match(panel, /Presupuesto por confirmar/);
  } finally { await server.close(); }
});
