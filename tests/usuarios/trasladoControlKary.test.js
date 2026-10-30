import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migracion = await readFile(
  new URL("../../supabase/migrations/20261030215500_trasladar_control_personal_a_kary.sql", import.meta.url),
  "utf8"
);

test("traslada el control de Karla Yoselin a la cuenta exacta de Kary", () => {
  assert.match(migracion, /KARI JIMENEZ/);
  assert.match(migracion, /karijim2390@gmail\.com/);
  assert.match(migracion, /gestionar_personal_operativo/);
  assert.match(migracion, /v_kary\.id, v_permiso, true/);
  assert.match(migracion, /v_karla\.id, 'gestionar_estado_usuarios', false/);
});

test("la alta delegada limita a Kary a perfiles operativos", async () => {
  const funcion = await readFile(
    new URL("../../supabase/functions/crear-usuario-monys/index.ts", import.meta.url),
    "utf8"
  );
  const panel = await readFile(
    new URL("../../src/features/usuarios/components/CentroUsuarios.jsx", import.meta.url),
    "utf8"
  );

  assert.match(funcion, /gestionar_personal_operativo/);
  assert.match(funcion, /ROLES_OPERATIVOS_PERSONAL\.has\(role\)/);
  assert.match(funcion, /Kary puede crear únicamente perfiles operativos/);
  assert.match(panel, /puedeGestionarPersonal \?/);
  assert.match(panel, /ROLES_OPERATIVOS_PERSONAL\.has\(role\.value\)/);
});
