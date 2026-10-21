import test from 'node:test';
import assert from 'node:assert/strict';
import { claveBorradorFlotilla, crearBorradorFlotilla } from '../../src/features/flotilla/utils/borradorFlotilla.js';

const inicial = { monto: '', nota: '' };
const contexto = { usuario: { organization_id: 'org', business_id: 'negocio', auth_user_id: 'usuario' }, unidad: 'u1', fecha: '2026-10-21', formulario: 'rental' };
function memoria() {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v), removeItem: (k) => datos.delete(k) };
}
test('aísla cada dimensión y no permite una identidad incompleta', () => {
  const clave = claveBorradorFlotilla(contexto);
  for (const campo of ['unidad', 'fecha', 'formulario']) assert.notEqual(clave, claveBorradorFlotilla({ ...contexto, [campo]: 'otro' }));
  for (const campo of ['organization_id', 'business_id', 'auth_user_id']) {
    assert.notEqual(clave, claveBorradorFlotilla({ ...contexto, usuario: { ...contexto.usuario, [campo]: 'otro' } }));
    assert.equal(claveBorradorFlotilla({ ...contexto, usuario: { ...contexto.usuario, [campo]: null } }), null);
  }
});
test('recupera tras recarga, remonte, cambio de fecha y versión de aplicación', () => {
  const storage = memoria();
  const clave = claveBorradorFlotilla(contexto);
  const a = crearBorradorFlotilla(storage, clave, inicial);
  a.cambiar({ monto: '0', nota: 'captura' });
  assert.equal(crearBorradorFlotilla(storage, 'otro-dia', inicial).getSnapshot().valor.monto, '');
  const b = crearBorradorFlotilla(storage, clave, inicial);
  assert.deepEqual(b.getSnapshot().valor, { monto: '0', nota: 'captura' });
  b.cargarServidor({ monto: '99', nota: 'servidor' });
  assert.equal(b.getSnapshot().valor.monto, '0');
});
test('confirmar limpia solo el borrador guardado y protege cambios durante la petición', () => {
  const storage = memoria();
  const a = crearBorradorFlotilla(storage, 'a', inicial);
  const b = crearBorradorFlotilla(storage, 'b', inicial);
  a.cambiar({ monto: '10', nota: '' }); b.cambiar({ monto: '20', nota: '' });
  const revision = a.getSnapshot().revision;
  a.cambiar({ monto: '11', nota: '' });
  a.confirmar(revision);
  assert.equal(a.getSnapshot().pendiente, true);
  a.confirmar(a.getSnapshot().revision);
  assert.equal(storage.getItem('a'), null);
  assert.notEqual(storage.getItem('b'), null);
  assert.equal(a.getSnapshot().mensaje, 'Guardado en MONYS OS');
});
test('descartar restaura la última captura del servidor sin tocar otros borradores', () => {
  const storage = memoria();
  const a = crearBorradorFlotilla(storage, 'a', inicial);
  a.cargarServidor({ monto: '0', nota: 'real' });
  a.cambiar({ monto: '30', nota: 'local' });
  a.descartar();
  assert.deepEqual(a.getSnapshot().valor, { monto: '0', nota: 'real' });
  assert.equal(a.getSnapshot().pendiente, false);
});
test('almacenamiento bloqueado o lleno informa sin perder la captura en memoria', () => {
  const storage = { getItem() { return null; }, setItem() { throw new Error('lleno'); } };
  const a = crearBorradorFlotilla(storage, 'a', inicial);
  a.cambiar({ monto: '50', nota: '' });
  assert.match(a.getSnapshot().mensaje, /Sin respaldo local/);
  assert.equal(a.getSnapshot().valor.monto, '50');
  assert.equal(a.getSnapshot().pendiente, true);
});
test('borrador corrupto se conserva para recuperación, sin romper el formulario', () => {
  const storage = memoria(); storage.setItem('a', '{corrupto');
  const a = crearBorradorFlotilla(storage, 'a', inicial);
  assert.deepEqual(a.getSnapshot().valor, inicial);
  assert.equal(storage.getItem('a'), '{corrupto');
  assert.match(a.getSnapshot().mensaje, /No se pudo recuperar/);
});
