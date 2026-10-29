import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
import { analizarFinanzas, calcularCapacidadCompra } from "../../src/features/inteligencia/shared/analizarFinanzas.js";
import { analizarFinanzas as analizarDashboard } from "../../src/features/dashboard/intelligence/finanzasAnalyzer.js";

test("un flujo positivo no se convierte en saldo disponible ni presupuesto de compra", () => {
  const resultado = analizarFinanzas({ financiero: { totalEntradas: 10000, totalSalidas: 2000, balance: 90000 } });
  assert.equal(resultado.flujoNetoTesoreria, 8000);
  assert.equal(resultado.balance, 8000);
  assert.equal(resultado.dineroDisponible, null);
  assert.equal(resultado.capacidadCompra, null);
  assert.equal(resultado.disponibilidadConfirmada, false);
  assert.match(resultado.recomendacion, /no equivale al saldo disponible/);
  assert.doesNotMatch(resultado.planAccion.join(" "), /comprar mercancía hasta|compras nuevas por debajo de/i);
});

test("flujo negativo, cero y ausencia de movimientos conservan compra pendiente, no un cero autorizado", () => {
  for (const financiero of [{ totalEntradas: 2000, totalSalidas: 10000 }, { totalEntradas: 10000, totalSalidas: 10000 }, {}]) {
    const resultado = analizarFinanzas({ financiero });
    assert.equal(resultado.capacidadCompra, null);
    assert.equal(resultado.dineroDisponible, null);
    assert.equal(calcularCapacidadCompra({ balance: 100000, nivelRiesgo: { nivel: "bajo" } }), null);
    assert.match(resultado.recomendacion, /confirma|por confirmar/i);
  }
});

test("Director General del dashboard sustituye la recomendación monetaria por una tarea de conciliación", () => {
  const resultado = analizarDashboard({ financiero: { totalEntradas: 10000, totalSalidas: 2000 } });
  assert.equal(resultado.capacidadCompra, null);
  assert.equal(resultado.resumen.some((tarjeta) => tarjeta.tipo === "capacidad-compra"), false);
  const pendiente = resultado.resumen.find((tarjeta) => tarjeta.tipo === "capacidad-compra-pendiente");
  assert(pendiente);
  assert.match(pendiente.descripcion, /no autoriza nuevas compras/i);
  assert.doesNotMatch(resultado.resumen.map((tarjeta) => tarjeta.descripcion).join(" "), /hasta \$/);
});

test("Panel Ejecutivo renderiza Por confirmar y etiqueta entradas menos salidas como flujo", async () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-only-placeholder";
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { default: Panel } = await server.ssrLoadModule("/src/features/inteligencia/components/PanelEjecutivoIA.jsx");
    const html = renderToString(React.createElement(Panel, {
      datosDashboard: { metricas: { ventasTotales: 20000, costoTotal: 12000, utilidadTotal: 8000, margenUtilidad: 40 } },
      movimientos: [{ tipo: "ENTRADA", monto: 10000 }, { tipo: "SALIDA", monto: 2000 }],
    }));
    assert.match(html, /Flujo neto del periodo/);
    assert.match(html, /no es el saldo de bancos y cajas/);
    assert.match(html, /Por confirmar/);
    assert.doesNotMatch(html, /Dinero disponible|Estimación prudente para proteger la liquidez|comprar mercancía hasta|destinar hasta|Negocio saludable/i);
    assert.match(html, /Liquidez<\/strong><strong[^>]*>Por confirmar<\/strong>/);
    assert.match(html, /ventas registradas suman/);
  } finally {
    await server.close();
  }
});
