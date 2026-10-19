import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261019050000_alcance_decisiones_ordenes_y_rpc.sql",
    import.meta.url,
  ),
  "utf8",
);

test("agrega alcance auditable sin inventarlo para registros legados", () => {
  assert.match(migration, /add column if not exists organization_id uuid/i);
  assert.match(migration, /add column if not exists created_by uuid references auth\.users/i);
  assert.match(migration, /PENDIENTE_CLASIFICACION/i);
  assert.match(migration, /join public\.branches branch on branch\.id = importacion\.branch_id/i);
  assert.doesNotMatch(migration, /set organization_id = '[0-9a-f-]{36}'/i);
});

test("asigna el alcance futuro en servidor y no confía en el cliente", () => {
  assert.match(migration, /function private\.monys_asignar_alcance_decision\(\)/i);
  assert.match(migration, /new\.created_by := \(select auth\.uid\(\)\)/i);
  assert.match(migration, /new\.scope_status := 'ASIGNADO'/i);
  assert.match(migration, /Sólo la propietaria puede registrar decisiones ejecutivas/i);
  assert.match(migration, /decision\.scope_status <> 'ASIGNADO'/i);
});

test("las políticas exigen propietaria activa dentro de su organización", () => {
  assert.match(migration, /create policy monys_decisiones_owner_select/i);
  assert.match(migration, /actor\.organization_id = decisiones_ejecutivas\.organization_id/i);
  assert.match(migration, /create policy monys_ordenes_owner_insert/i);
  assert.match(migration, /actor\.organization_id = ordenes_compra\.organization_id/i);
  assert.match(migration, /scope_status = 'ASIGNADO'[\s\S]*created_by = \(select auth\.uid\(\)\)/i);
});

test("el legado sólo permanece visible mientras existe una sola organización activa", () => {
  assert.match(migration, /function private\.monys_owner_puede_ver_registro_legacy\(\)/i);
  assert.match(migration, /count\(\*\)[\s\S]*organizations[\s\S]*= 1/i);
  assert.match(migration, /scope_status = 'PENDIENTE_CLASIFICACION'/i);
});

test("revoca todas las funciones privilegiadas y reabre sólo la lista auditada", () => {
  assert.match(migration, /where n\.nspname = 'public' and p\.prosecdef/i);
  assert.match(migration, /revoke execute on function %s from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.activar_chofer_con_codigo\(text, text\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.registrar_revision_corte_diario/i);
  assert.match(migration, /grant execute on function public\.solicitar_convenio_pnr_flotilla/i);
});
