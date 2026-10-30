import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

test("historial y verificación filtran por el negocio activo", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { supabase } = await server.ssrLoadModule("/src/supabase.js");
    const filtros = [];
    supabase.from = () => {
      const consulta = {
        select() { return consulta; },
        eq(campo, valor) { filtros.push([campo, valor]); return consulta; },
        order() { return consulta; },
        limit() { return Promise.resolve({ data: [], error: null }); },
      };
      return consulta;
    };
    const servicio = await server.ssrLoadModule("/src/features/inventario/services/compraPlanService.js");
    await servicio.obtenerHistorialPlanesCompra(20, "negocio-1");
    await servicio.verificarPlanActualGuardado({ productos: [] }, "negocio-1");
    assert.equal(filtros.filter(([campo, valor]) => campo === "business_id" && valor === "negocio-1").length, 2);
  } finally {
    await server.close();
  }
});
