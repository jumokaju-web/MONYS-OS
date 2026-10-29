import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

test("la portada de Dirección abre compacta y ofrece navegación por botones", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });

  try {
    const { default: InicioJefa } = await server.ssrLoadModule("/src/features/dashboard/InicioJefa.jsx");
    const html = renderToString(React.createElement(InicioJefa, {
      usuario: { organization_id: "org-1", business_id: "business-1" },
      sucursalesDashboard: [],
      formatoDinero: (valor) => `$${Number(valor || 0).toFixed(2)}`,
    }));

    assert.match(html, /Secciones principales de Dirección/);
    assert.match(html, />Resumen</);
    assert.match(html, />Gráficas</);
    assert.match(html, />Operación</);
    assert.match(html, />Áreas</);
    assert.match(html, /Lo que necesita tu atención/);
    assert.doesNotMatch(html, /Del rescate a un negocio franquiciable/);
  } finally {
    await server.close();
  }
});
