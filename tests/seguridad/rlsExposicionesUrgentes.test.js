import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261019034000_cerrar_exposiciones_publicas_urgentes.sql",
    import.meta.url,
  ),
  "utf8",
);

const legacyCreditsRepair = readFileSync(
  new URL(
    "../../supabase/migrations/20261019035000_restaurar_creditos_proveedor_por_sucursal.sql",
    import.meta.url,
  ),
  "utf8",
);

test("revoca a anon en objetos existentes y futuros", () => {
  assert.match(migration, /alter default privileges[\s\S]*revoke all on tables from anon/i);
  assert.match(migration, /revoke all on all tables in schema public from anon/i);
  assert.match(migration, /revoke execute on all functions in schema public from anon/i);
});

test("elimina políticas públicas destructivas y abiertas", () => {
  assert.match(migration, /drop policy if exists "Permitir todo ordenes_compra"/i);
  assert.match(migration, /drop policy if exists monys_tarea_evaluaciones_all/i);
  assert.match(migration, /drop policy if exists monys_delete_empleados/i);
  assert.match(migration, /drop policy if exists "Permitir consultar decisiones anon"/i);
  assert.doesNotMatch(migration, /create policy[\s\S]{0,160}to anon/i);
});

test("protege datos financieros y de Dirección por rol y alcance", () => {
  assert.match(migration, /create policy monys_accounts_select_alcance/i);
  assert.match(migration, /actor\.organization_id = accounts\.organization_id/i);
  assert.match(migration, /create policy monys_creditos_proveedores_select_alcance/i);
  assert.match(migration, /importacion\.id = creditos_proveedores\.importacion_id/i);
  assert.match(migration, /create policy monys_decisiones_owner_select/i);
  assert.match(migration, /lower\(actor\.role\) = 'owner'/i);
});

test("las evaluaciones heredan el alcance de su tarea", () => {
  assert.match(migration, /create policy monys_tarea_evaluaciones_select_alcance/i);
  assert.match(migration, /tarea\.id = tarea_evaluaciones\.tarea_id/i);
  assert.match(migration, /private\.monys_puede_acceder_alcance_operativo/i);
});

test("la vista de flotilla obedece RLS y conserva lectura autenticada", () => {
  assert.match(migration, /alter view public\.flotilla_saldo_semanal_chofer set \(security_invoker = true\)/i);
  assert.match(migration, /revoke all on table public\.flotilla_saldo_semanal_chofer from anon, authenticated/i);
  assert.match(migration, /grant select on table public\.flotilla_saldo_semanal_chofer to authenticated/i);
});

test("las funciones privilegiadas ya no son públicas", () => {
  assert.match(migration, /where n\.nspname = 'public' and p\.prosecdef/i);
  assert.match(migration, /revoke execute on function %s from public, anon/i);
  assert.match(migration, /funcion\.retorno = 'trigger'/i);
  assert.match(migration, /clasificar_gasolina_por_evidencias\(uuid\)[\s\S]*from public, anon, authenticated/i);
});

test("los créditos heredados derivan organización desde su sucursal real", () => {
  assert.match(legacyCreditsRepair, /join public\.branches sucursal on sucursal\.id = importacion\.branch_id/i);
  assert.match(legacyCreditsRepair, /join public\.businesses negocio on negocio\.id = sucursal\.business_id/i);
  assert.match(legacyCreditsRepair, /actor\.organization_id = negocio\.organization_id/i);
  assert.doesNotMatch(legacyCreditsRepair, /actor\.organization_id = importacion\.organization_id/i);
});
