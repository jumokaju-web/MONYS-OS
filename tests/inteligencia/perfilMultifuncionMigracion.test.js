import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migracion = await readFile(
  new URL("../../supabase/migrations/20261019013000_perfil_multifuncion_tienda.sql", import.meta.url),
  "utf8",
);

test("permite las cinco funciones sin abrir el catálogo de áreas", () => {
  assert.match(migracion, /drop constraint if exists empleado_config_areas_cantidad/i);
  assert.match(migracion, /cardinality\(areas_asignadas\) between 1 and 5/i);
  assert.doesNotMatch(migracion, /drop constraint if exists empleado_config_areas_validas/i);
  assert.doesNotMatch(migracion, /disable row level security/i);
});
