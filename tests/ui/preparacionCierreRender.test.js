import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { prepararRutaCierre } from "../../src/features/finanzas/utils/preparacionCierre.js";

test("la preparación muestra pasos pendientes y cada botón abre su área real", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { VistaPreparacionCierre } = await server.ssrLoadModule("/src/features/finanzas/components/PreparacionCierre.jsx");
    const plan = prepararRutaCierre({ movimientos: [], errorMovimientos: true });
    const aperturas = [];
    const props = { plan, onAbrirArea: (...args) => aperturas.push(args), estadoConsulta: "error", error: "No se pudo consultar" };
    const html = renderToString(React.createElement(VistaPreparacionCierre, props));
    assert.match(html, /Tu ruta para terminar el cierre/);
    assert.match(html, /El cierre sigue abierto/);
    assert.match(html, /Puedes avanzar sin cargar el banco ahora/);
    assert.match(html, /consulta fallida no se interpreta como cero/);
    assert.doesNotMatch(html, /0 movimientos pendientes|Semana conciliada/);
    const visitar = (nodo) => {
      if (Array.isArray(nodo)) return nodo.forEach(visitar);
      if (!nodo?.props) return;
      if (nodo.type === "button") nodo.props.onClick();
      visitar(nodo.props.children);
    };
    visitar(VistaPreparacionCierre(props));
    assert(aperturas.some(([area, vista]) => area === "plan" && vista === "cierre"));
    assert(aperturas.some(([area, vista]) => area === "plan" && vista === "proveedores"));
    assert(aperturas.some(([area, vista]) => area === "plan" && vista === "panorama"));
    assert(aperturas.some(([area]) => area === "bancos"));
    assert(aperturas.some(([area]) => area === "control"));
  } finally { await server.close(); }
});
