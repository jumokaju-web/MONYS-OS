import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparHistorialLaboral } from '../../src/features/inteligencia/shared/historialLaboral.js';

test('agrupa bajas y reactivaciones por empleada sin perder el orden recibido', () => {
  const grupos = agruparHistorialLaboral([
    { id: 'm2', empleado_id: 'e1', tipo: 'REACTIVACION' },
    { id: 'm1', empleado_id: 'e1', tipo: 'BAJA' },
    { id: 'm3', empleado_id: 'e2', tipo: 'BAJA' },
    { id: 'invalido', tipo: 'BAJA' },
  ]);
  assert.deepEqual(grupos.e1.map((item) => item.id), ['m2', 'm1']);
  assert.deepEqual(grupos.e2.map((item) => item.id), ['m3']);
});

test('acepta una entrada vacía o inválida', () => {
  assert.deepEqual(agruparHistorialLaboral(), {});
  assert.deepEqual(agruparHistorialLaboral(null), {});
});
