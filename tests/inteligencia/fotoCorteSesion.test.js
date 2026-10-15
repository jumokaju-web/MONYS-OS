import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const fuente = await readFile(new URL('../../src/features/inteligencia/services/cierresTurnoService.js', import.meta.url), 'utf8');
async function servicio(respuesta) {
  const mock = `export const llamadas = []; const supabase = {
    auth: { getUser: async () => { llamadas.push('auth'); return ${JSON.stringify(respuesta)}; } },
    storage: { from: () => ({ upload: async () => { llamadas.push('upload'); return {error:null}; }, getPublicUrl: () => ({data:{publicUrl:'https://example.test/evidencia'}}) }) }
  };`;
  const codigo = fuente.replace(/import .*fechaOperativaMexico.*;\n/, 'const fechaOperativaMexico = () => "2026-10-14";\n').replace(/import \{ supabase \} from .*;\n/, mock);
  return import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}#${Math.random()}`);
}
const archivo = {name:'corte.png',type:'image/png'};
test('la foto no se sube si falta sesión o la comprobación de sesión falla', async () => {
  for (const respuesta of [{data:{user:null},error:null},{data:{user:{id:'usuaria'}},error:{message:'venció'}}]) {
    const s = await servicio(respuesta);
    await assert.rejects(s.subirFotoCorteCaja({archivo,branchId:'tienda'}), /sesión venció/);
    assert.deepEqual(s.llamadas,['auth']);
  }
});
test('la foto requiere sucursal y permite subir con una sesión confirmada', async () => {
  const s = await servicio({data:{user:{id:'usuaria'}},error:null});
  await assert.rejects(s.subirFotoCorteCaja({archivo}), /sucursal/);
  assert.deepEqual(s.llamadas,[]);
  const evidencia = await s.subirFotoCorteCaja({archivo,branchId:'tienda'});
  assert.deepEqual(s.llamadas,['auth','upload']);
  assert.match(evidencia.archivoPath,/^usuaria\/cierres-caja\/tienda\//);
});
