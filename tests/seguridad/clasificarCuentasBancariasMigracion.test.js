import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL(
  "../../supabase/migrations/20261027231000_clasificar_cuentas_bancarias.sql",
  import.meta.url,
), "utf8");
const hardenedMigration = await readFile(new URL(
  "../../supabase/migrations/20261027232000_cuentas_bancarias_rls_invoker.sql",
  import.meta.url,
), "utf8");
const anonymousAccountsMigration = await readFile(new URL(
  "../../supabase/migrations/20261027233000_bloquear_anonimos_cuentas.sql",
  import.meta.url,
), "utf8");

test("la clasificación de cuentas solo se realiza por una propietaria autenticada", () => {
  assert.match(migration, /coalesce\(\(auth\.jwt\(\)->>'is_anonymous'\)::boolean, true\)/);
  assert.match(migration, /lower\(role\) = 'owner'/);
  assert.match(migration, /grant execute on function public\.clasificar_cuenta_bancaria[\s\S]*to authenticated/);
  assert.match(migration, /revoke all on function public\.clasificar_cuenta_bancaria[\s\S]*from public, anon/);
});

test("solo una cuenta empresarial recibe negocio y cada clasificación conserva nota y auditoría", () => {
  assert.match(migration, /if v_scope = 'EMPRESA' then[\s\S]*v_business_id := p_business_id/);
  assert.match(migration, /else[\s\S]*if p_business_id is not null[\s\S]*v_business_id := null/);
  assert.match(migration, /insert into public\.account_ownership_events/);
  assert.match(migration, /ownership_confirmed_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /ownership_confirmed_at = v_confirmed_at/);
});

test("la función usa RLS de la sesión y la política limita cambios a bancos pendientes de la propietaria", () => {
  assert.match(hardenedMigration, /security invoker/);
  assert.match(hardenedMigration, /create policy accounts_owner_classifies_pending_bank[\s\S]*for update to authenticated/);
  assert.match(hardenedMigration, /ownership_scope = 'PENDIENTE'[\s\S]*lower\(actor\.role\) = 'owner'/);
  assert.match(hardenedMigration, /ownership_scope in \('PERSONAL', 'MIXTA'\) and business_id is null/);
  assert.match(hardenedMigration, /create unique index if not exists account_ownership_events_account_once_idx/);
});

test("la política de lectura de cuentas conserva sus roles y bloquea sesiones anónimas", () => {
  assert.match(anonymousAccountsMigration, /create policy monys_accounts_select_alcance[\s\S]*for select to authenticated/);
  assert.match(anonymousAccountsMigration, /\(select \(auth\.jwt\(\)->>'is_anonymous'\)::boolean\) is false/);
  assert.match(anonymousAccountsMigration, /'owner', 'admin', 'director', 'finanzas', 'encargada', 'vendedora'/);
  assert.match(anonymousAccountsMigration, /actor\.organization_id = accounts\.organization_id/);
});
