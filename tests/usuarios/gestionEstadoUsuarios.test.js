import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raiz = new URL("../../", import.meta.url);

async function leer(ruta) {
  return readFile(new URL(ruta, raiz), "utf8");
}

test("Kary puede activar o pausar sin recibir permisos de propietaria", async () => {
  const migracion = await leer(
    "supabase/migrations/20261030213000_gestion_estado_usuarios_por_permiso.sql"
  );

  assert.match(migracion, /gestionar_estado_usuarios/);
  assert.match(migracion, /p_role_objetivo <> 'owner'/);
  assert.match(migracion, /upper\(trim\(usuario\.nombre\)\) = 'KARLA YOSELIN'/);
  assert.match(migracion, /v_coincidencias <> 1/);
  assert.doesNotMatch(migracion, /set\s+role\s*=/i);
});

test("el panel separa sucursales y reserva permisos y eliminación a Mónica", async () => {
  const panel = await leer("src/features/usuarios/components/CentroUsuarios.jsx");
  const app = await leer("src/App.jsx");

  assert.match(panel, /Filtrar usuarios por sucursal/);
  assert.match(panel, /sucursalPorId\.get\(usuario\.branch_id\)/);
  assert.match(panel, /puedeGestionarEstado && usuario\.role/);
  assert.match(panel, /esPropietaria && <button/);
  assert.match(app, /puede\("gestionar_estado_usuarios"\)/);
});
