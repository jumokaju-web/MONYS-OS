import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../src/features/inteligencia/services/empleadosRHService.js', import.meta.url), 'utf8')
  .replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];/g, '')
  .replace(/export /g, '');

function servicio({ empleados, usuarios, errorUsuarios = null }) {
  const supabase = { from(tabla) {
    return {
      select() { return this; }, eq() { return this; },
      order() { return Promise.resolve({ data: empleados, error: null }); },
      in(campo, valores) { return Promise.resolve({ data: usuarios.filter(u => valores.includes(u[campo])), error: errorUsuarios }); },
    };
  } };
  return new Function('supabase', `${fuente}; return { obtenerEmpleadosActivosParaAsignacion };`)(supabase);
}

test('la lista para asignar resuelve perfil y acceso sin confundir sus identificadores', async () => {
  const api = servicio({ empleados: [{ id: 'e1', usuario_id: 'perfil-1' }, { id: 'e2', usuario_id: 'auth-2' }, { id: 'e3', usuario_id: null }], usuarios: [{ id: 'perfil-1', auth_user_id: 'auth-1' }, { id: 'perfil-2', auth_user_id: 'auth-2' }] });
  const resultado = await api.obtenerEmpleadosActivosParaAsignacion('centro');
  assert.deepEqual(resultado.map(e => e.auth_user_id), ['auth-1', 'auth-2', null]);
  assert.equal(resultado[0].usuario_id, 'perfil-1');
});

test('si no puede comprobar el acceso no entrega una lista aparentemente lista para asignar', async () => {
  const api = servicio({ empleados: [{ usuario_id: 'perfil-1' }], usuarios: [], errorUsuarios: new Error('sin conexión') });
  await assert.rejects(api.obtenerEmpleadosActivosParaAsignacion('centro'), /sin conexión/);
});
