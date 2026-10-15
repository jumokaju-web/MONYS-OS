import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20261015051500_consolidar_politicas_configuracion_operativa.sql", import.meta.url),
  "utf8",
);

test("Dirección configura perfiles solo dentro de su organización, negocio y sucursal", () => {
  assert.match(sql, /role in \('owner', 'director', 'admin', 'rh'\)/);
  assert.match(sql, /direccion\.organization_id = e\.organization_id/);
  assert.match(sql, /direccion\.business_id is null or direccion\.business_id = e\.business_id/);
  assert.match(sql, /direccion\.branch_id is null or direccion\.branch_id = e\.branch_id/);
});

test("el perfil operativo conserva el acceso autenticado vinculado a la ficha", () => {
  assert.match(sql, /e\.usuario_id = empleado_configuracion_operativa\.usuario_id/);
  assert.match(sql, /acceso\.auth_user_id = empleado_configuracion_operativa\.usuario_id/);
  assert.match(sql, /for update to authenticated[\s\S]*with check/);
  assert.match(sql, /usuario_id = \(select auth\.uid\(\)\)/);
});
