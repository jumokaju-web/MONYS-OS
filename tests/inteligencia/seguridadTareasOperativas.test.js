import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261016201000_secure_tareas_operativas_y_evidencias.sql", import.meta.url),
  "utf8",
);

const service = readFileSync(
  new URL("../../src/features/inteligencia/services/tareasOperativasService.js", import.meta.url),
  "utf8",
);

test("el acceso a tareas se limita al perfil autenticado y deja reclamar correcciones de inventario pendientes", () => {
  assert.match(migration, /left join public\.branches sucursal[\s\S]*?left join public\.businesses negocio/);
  assert.match(migration, /tarea\.business_id is distinct from sucursal\.business_id/);
  assert.match(migration, /set\s+business_id = sucursal\.business_id,\s+organization_id = negocio\.organization_id/);
  assert.match(migration, /actor\.auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /actor\.organization_id = p_organization_id/);
  assert.match(migration, /actor\.branch_id is not distinct from p_branch_id/);
  assert.match(migration, /join public\.empleados empleado[\s\S]*?lower\(btrim\(empleado\.nombre\)\) = lower\(btrim\(tarea\.responsable\)\)/);
  assert.match(migration, /usuario\.id = empleado\.usuario_id[\s\S]*?usuario\.active is true[\s\S]*?count\(distinct usuario\.auth_user_id\) = 1/);
  assert.match(migration, /p_permitir_reclamo and p_responsable_usuario_id is null/);
  assert.equal((migration.match(/area = 'inventario'[\s\S]*?estado = 'pendiente'[\s\S]*?responsable is null/g) || []).length, 2);
  assert.match(service, /responsable_usuario_id:\s*auth\.user\.id/);
});

test("las evidencias requieren una tarea accesible y ya no dependen de un bucket público", () => {
  assert.match(migration, /update storage\.buckets\s+set public = false\s+where id = 'tareas-evidencias'/);
  assert.match(migration, /drop policy if exists monys_tareas_evidencias_select on storage\.objects/);
  assert.match(migration, /where tarea\.id::text = split_part\(storage\.objects\.name, '\/', 1\)/);
  assert.match(service, /createSignedUrl\(evidencia\.archivo_path, 60 \* 60\)/);
  assert.doesNotMatch(service, /getPublicUrl\(/);
});

test("los accesos anónimos y las políticas abiertas antiguas se revocan", () => {
  assert.match(migration, /revoke all on table public\.tareas_operativas from anon, authenticated/);
  assert.match(migration, /revoke all on table public\.tarea_evidencias from anon, authenticated/);
  assert.match(migration, /drop policy if exists monys_read_tareas_operativas on public\.tareas_operativas/);
  assert.match(migration, /drop policy if exists monys_tarea_evidencias_all on public\.tarea_evidencias/);
  assert.match(migration, /drop policy if exists "Permitir leer usuarios" on public\.usuarios/);
});
