import test from 'node:test';
import assert from 'node:assert/strict';
import { claveBorradorCierre, leerBorradorCierre, guardarBorradorCierre } from '../../src/features/inteligencia/utils/borradorCierreFinanciero.js';
const usuario = { auth_user_id: 'u1', organization_id: 'org', business_id: 'b1' };
const memoria = () => { const datos = new Map(); return { getItem: (k) => datos.get(k) ?? null, setItem: (k,v) => datos.set(k,v) }; };
test('aísla el avance entre usuarios, negocios y cortes', () => {
  const k = claveBorradorCierre(usuario, '2026-09-28', '2026-10-04');
  assert.notEqual(k, claveBorradorCierre({ ...usuario, auth_user_id: 'u2' }, '2026-09-28', '2026-10-04'));
  assert.notEqual(k, claveBorradorCierre({ ...usuario, business_id: 'b2' }, '2026-09-28', '2026-10-04'));
  assert.notEqual(k, claveBorradorCierre(usuario, '2026-10-05', '2026-10-11'));
  assert.equal(claveBorradorCierre({}, 'inicio', 'fin'), null);
});
test('recupera confirmaciones y las invalida al cambiar los datos', () => {
  const storage = memoria();
  assert.equal(guardarBorradorCierre(storage, 'clave', 'revision1', { ventas: true, banco: 'true' }), true);
  assert.equal(leerBorradorCierre(storage, 'clave', 'revision1').confirmaciones.ventas, true);
  assert.equal(leerBorradorCierre(storage, 'clave', 'revision1').confirmaciones.banco, false);
  assert.deepEqual(leerBorradorCierre(storage, 'clave', 'revision2'), { confirmaciones: {}, estado: 'datos_cambiaron' });
});
test('informa fallos de lectura y guardado sin aparentar persistencia', () => {
  const storage = { getItem() { throw Error('bloqueado'); }, setItem() { throw Error('lleno'); } };
  assert.equal(leerBorradorCierre(storage, 'clave', 'v').estado, 'error');
  assert.equal(guardarBorradorCierre(storage, 'clave', 'v', {}), false);
});
