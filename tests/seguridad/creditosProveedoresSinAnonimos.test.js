import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL(
  "../../supabase/migrations/20261027230000_bloquear_anonimos_cero_creditos.sql",
  import.meta.url,
), "utf8");

test("la consulta y el registro de cero créditos rechazan sesiones anónimas", () => {
  assert.equal((migration.match(/\(select \(auth\.jwt\(\)->>'is_anonymous'\)::boolean\) is false/g) || []).length, 2);
  assert.match(migration, /create policy monys_creditos_proveedores_confirmaciones_select[\s\S]*?for select to authenticated[\s\S]*?is false/);
  assert.match(migration, /create policy monys_creditos_proveedores_confirmaciones_insert[\s\S]*?for insert to authenticated[\s\S]*?is false/);
  assert.match(migration, /confirmado_por = \(select auth\.uid\(\)\)/);
});
