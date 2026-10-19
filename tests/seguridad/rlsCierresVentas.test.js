import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261019040000_proteger_cierres_y_ventas_articulos.sql",
    import.meta.url,
  ),
  "utf8",
);

test("elimina las políticas abiertas heredadas", () => {
  assert.match(migration, /drop policy if exists permitir_select_cierres_autenticados/i);
  assert.match(migration, /drop policy if exists permitir_insert_cierres_autenticados/i);
  assert.match(migration, /drop policy if exists ventas_articulos_select_authenticated/i);
  assert.match(migration, /drop policy if exists ventas_articulos_insert_authenticated/i);
  assert.doesNotMatch(migration, /(?:using|with check)\s*\(\s*true\s*\)/i);
});

test("los cierres registran autor y respetan organización, negocio y sucursal", () => {
  assert.match(migration, /add column if not exists created_by uuid null references auth\.users\(id\)/i);
  assert.match(migration, /alter column created_by set default auth\.uid\(\)/i);
  assert.match(migration, /actor\.organization_id = negocio\.organization_id/i);
  assert.match(migration, /actor\.business_id = sucursal\.business_id/i);
  assert.match(migration, /actor\.branch_id = cierres_turno\.branch_id/i);
  assert.match(migration, /created_by = \(select auth\.uid\(\)\)/i);
});

test("flotilla sólo ve sus propios cierres y tienda conserva la operación compartida", () => {
  assert.match(migration, /lower\(actor\.role\) in \('vendedora', 'encargada'\)/i);
  assert.match(migration, /cierres_turno\.created_by = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /permission = 'ver_finanzas'/i);
});

test("ventas hereda el alcance de la importación y exige permiso efectivo", () => {
  assert.match(migration, /importacion\.id = ventas_articulos\.importacion_id/i);
  assert.match(migration, /actor\.branch_id = importacion\.branch_id/i);
  assert.match(migration, /permission = 'ver_ventas'/i);
  assert.match(migration, /user_permission_overrides/i);
  assert.match(migration, /role_permissions/i);
  assert.match(migration, /importacion\.created_by = \(select auth\.uid\(\)\)/i);
});

test("anon queda revocado y authenticated recibe sólo lectura e inserción", () => {
  assert.match(migration, /revoke all on table public\.cierres_turno from anon, authenticated/i);
  assert.match(migration, /grant select, insert on table public\.cierres_turno to authenticated/i);
  assert.match(migration, /revoke all on table public\.ventas_articulos from anon, authenticated/i);
  assert.match(migration, /grant select, insert on table public\.ventas_articulos to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*(?:update|delete)[^;]*to authenticated/i);
});
