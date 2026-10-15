import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migracion = await readFile(new URL(
  "../../supabase/migrations/20261015023000_cierres_turno_finanzas_owner.sql",
  import.meta.url,
), "utf8");

test("la bandeja de Dirección obtiene cierres mediante una función protegida", () => {
  assert.match(migracion, /create or replace function public\.obtener_cierres_turno_finanzas_owner/i);
  assert.match(migracion, /security definer/i);
  assert.match(migracion, /set search_path = public, pg_temp/i);
  assert.match(migracion, /u\.auth_user_id = auth\.uid\(\)/i);
  assert.match(migracion, /u\.active = true/i);
  assert.match(migracion, /u\.role = 'owner'/i);
});

test("la función limita los cierres a organización y negocio de la propietaria", () => {
  assert.match(migracion, /b\.id = v_business_id/i);
  assert.match(migracion, /b\.organization_id = v_organization_id/i);
  assert.match(migracion, /join public\.branches s on s\.id = c\.branch_id/i);
  assert.match(migracion, /limit least\(greatest\(coalesce\(p_limite, 100\), 1\), 500\)/i);
});

test("no concede acceso anónimo ni lectura directa adicional", () => {
  assert.match(migracion, /revoke all on function[\s\S]*from anon/i);
  assert.match(migracion, /grant execute on function[\s\S]*to authenticated/i);
  assert.doesNotMatch(migracion, /grant select on public\.cierres_turno/i);
});
