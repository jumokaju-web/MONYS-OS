import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarDecision } from '../../src/features/inteligencia/engine/motorEjecutivoIA.js';

test('áreas sin conexión no afirman ejecución ni envío', async () => {
  for (const tipo of ['FINANZAS', 'COMERCIAL', 'MARKETING', 'RECURSOS_HUMANOS', 'LOGISTICA', 'GENERAL']) {
    const r = await ejecutarDecision({ id: 'decision', tipo });
    assert.equal(r.estado, 'PENDIENTE_EJECUCION');
    assert.equal(r.ejecutadaEn, null);
    assert.doesNotMatch(r.mensaje, /fue enviada|creada correctamente/);
  }
});
test('orden registrada no equivale a compra ejecutada', async () => {
  const r = await ejecutarDecision({ id: 'decision', tipo: 'COMPRA' }, { crearOrden: async () => ({ id: 'orden', estado: 'PENDIENTE' }) });
  assert.equal(r.estado, 'ORDEN_CREADA');
  assert.equal(r.ordenCompra.id, 'orden');
  assert.equal(r.ejecutadaEn, null);
});
test('fallos o ausencia de confirmación nunca producen éxito', async () => {
  await assert.rejects(ejecutarDecision({ tipo: 'COMPRA' }, { crearOrden: async () => null }), /No se confirmó/);
  await assert.rejects(ejecutarDecision({ tipo: 'COMPRA' }, { crearOrden: async () => { throw new Error('sin conexión'); } }), /sin conexión/);
  await assert.rejects(ejecutarDecision(null), /No se recibió/);
});
