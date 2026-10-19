import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migracion = readFileSync(
  new URL(
    "../../supabase/migrations/20261019164122_proteger_funciones_operativas_direccion.sql",
    import.meta.url,
  ),
  "utf8",
);

const perfil = readFileSync(
  new URL(
    "../../src/features/inteligencia/components/PerfilOperativoEmpleado.jsx",
    import.meta.url,
  ),
  "utf8",
);

test("la empleada no puede cambiar identidad ni funciones de su configuración", () => {
  assert.match(migracion, /tg_op = 'UPDATE'/i);
  assert.match(migracion, /new\.empleado_id is distinct from old\.empleado_id/i);
  assert.match(migracion, /new\.areas_asignadas is distinct from old\.areas_asignadas/i);
  assert.match(migracion, /solo dirección puede cambiar las funciones de trabajo/i);
});

test("Dirección conserva la edición únicamente dentro de su alcance", () => {
  assert.match(migracion, /lower\(direccion\.role\) in \('owner', 'director', 'admin', 'rh'\)/i);
  assert.match(migracion, /direccion\.organization_id = empleado\.organization_id/i);
  assert.match(migracion, /direccion\.business_id is null or direccion\.business_id = empleado\.business_id/i);
  assert.match(migracion, /direccion\.branch_id is null or direccion\.branch_id = empleado\.branch_id/i);
});

test("un perfil nuevo solo acepta funciones autorizadas por RH", () => {
  assert.match(migracion, /new\.usuario_id is distinct from actor_id/i);
  assert.match(migracion, /perfil operativo debe pertenecer a la sesión autenticada/i);
  assert.match(migracion, /empleado\.responsabilidades/i);
  assert.match(migracion, /areas_solicitadas is distinct from responsabilidades_autorizadas/i);
  assert.match(migracion, /dirección debe asignar funciones antes de crear el perfil operativo/i);
});

test("la función privilegiada queda privada y no es ejecutable por clientes", () => {
  assert.match(migracion, /security definer[\s\S]*set search_path = pg_catalog/i);
  assert.match(migracion, /revoke all on function private\.monys_proteger_funciones_config_operativa\(\)[\s\S]*from public, anon, authenticated/i);
});

test("el perfil de la empleada muestra funciones de solo lectura", () => {
  assert.match(perfil, /Dirección asigna estas funciones/i);
  assert.doesNotMatch(perfil, /type="checkbox"/i);
  assert.doesNotMatch(perfil, /alternarArea/i);
});
