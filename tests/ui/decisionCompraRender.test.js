import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

test("la decisión explica el presupuesto pendiente y muestra cinco prioridades", async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  const { default: DecisionCompraInteligente } = await server.ssrLoadModule("/src/features/inventario/components/DecisionCompraInteligente.jsx");
  const productosPriorizados = Array.from({ length: 7 }, (_, indice) => ({
    llave: `p${indice}`,
    descripcion: `Producto ${indice}`,
    prioridadCompra: indice < 2 ? "CRITICA" : "ALTA",
    motivoPrioridad: `${indice + 1} días de cobertura`,
    compraTotal: indice + 1,
    inversionTotal: (indice + 1) * 100,
    costoConocido: true,
  }));
  const html = renderToString(React.createElement(DecisionCompraInteligente, { decision: {
    estado: "PENDIENTE_DATOS",
    productosCriticos: 2,
    inversionPropuesta: 2800,
    capacidadCompra: null,
    inversionCritica: 300,
    productosPriorizados,
    bloqueos: ["Confirmar dinero disponible y presupuesto de compra en Finanzas."],
    advertencias: ["2 productos con existencia negativa permanecen fuera de la compra."],
  } }));
  assert.match(html, /Preparar la compra; autorización pendiente/);
  assert.match(html, /Presupuesto confirmado/);
  assert.match(html, /Pendiente/);
  assert.match(html, /no genera pedidos ni movimientos/);
  assert.match(html, /Producto 4/);
  assert.doesNotMatch(html, /Producto 5/);
  await server.close();
});

test("el historial no convierte un presupuesto pendiente en cero", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { DecisionFinancieraPlan } = await server.ssrLoadModule("/src/features/inventario/components/HistorialCompraMaestra.jsx");
    const html = renderToString(React.createElement(DecisionFinancieraPlan, { plan: { resumen: { decisionFinanciera: {
      estado: "PENDIENTE_DATOS",
      compraAutorizable: false,
      inversionPropuesta: 1000,
      capacidadAutorizable: null,
      faltanteParaAutorizar: null,
    } } } }));
    assert.match(html, /Presupuesto pendiente de confirmar/);
    assert.equal((html.match(/Pendiente/g) || []).length >= 2, true);
    assert.doesNotMatch(html, /\$0\.00/);
  } finally {
    await server.close();
  }
});
