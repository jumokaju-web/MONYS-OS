import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../../supabase/migrations/20261027103000_secure_pnr_discount_permissions.sql", import.meta.url),
  "utf8",
);

const funcionesPrivilegiadas = [
  "flotilla_puede_gestionar_pnr(uuid)",
  "flotilla_es_admin_de_organizacion(uuid)",
  "flotilla_puede_ver_unidad(uuid)",
  "aplicar_descuento_pnr_flotilla(uuid, date, date, numeric, text)",
];

test("las funciones privilegiadas PNR revocan anon y otorgan acceso a authenticated", () => {
  for (const funcion of funcionesPrivilegiadas) {
    assert.ok(migration.includes(`revoke all on function public.${funcion} from public, anon;`));
    assert.ok(migration.includes(`grant execute on function public.${funcion} to authenticated;`));
  }
});
