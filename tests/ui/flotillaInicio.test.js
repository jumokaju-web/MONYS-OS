import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('Flotilla abre en accesos de trabajo sin cargar formularios PNR, pagos ni códigos', async () => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-only-placeholder';
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: Inicio } = await server.ssrLoadModule('/src/features/flotilla/components/FlotillaAdministracion.jsx');
    const html = renderToStaticMarkup(React.createElement(Inicio, { usuario: { nombre: 'Mónica', role: 'owner' }, unidades: [{ id: 'test' }], puedeGestionarPnr: true }));
    assert.match(html, /Hola, Mónica/);
    assert.match(html, /aria-current="page">Inicio/);
    assert.match(html, /Secciones de Flotilla/);
    for (const titulo of ['Hoy', 'Semana', 'Evidencias', 'PNR', 'Rental', 'Accesos']) assert.ok(html.includes(titulo));
    assert.doesNotMatch(html, /<input|<select|<textarea|Registrar aviso recibido|Dar o actualizar acceso|Aplicar descuento/);
    assert.ok(html.indexOf('Rutas, gasolina y adelantos') < html.indexOf('Investigar y dar seguimiento'));

    const socio = renderToStaticMarkup(React.createElement(Inicio, { usuario: { nombre: 'Socio' }, soloConsulta: true }));
    assert.doesNotMatch(socio, />Accesos<|>PNR</);
    assert.match(socio, /CONSULTA/);
    assert.doesNotMatch(socio, /Registrar pago|Registrar entrega|Dar o actualizar acceso/);
  } finally { await server.close(); }
});
