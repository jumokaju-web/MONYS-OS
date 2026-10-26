import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../../supabase/migrations/20261026010000_comprobar_retiros_efectivo.sql", import.meta.url), "utf8");

test("la bitácora es append-only y separa reportado de comprobado", () => {
  assert.match(sql, /estado in \('REPORTADO','COMPROBADO','DIFERENCIA'\)/);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)/i);
  assert.match(sql, /unique \(cierre_id, caja_id, version\)/);
});

test("la lectura de comprobantes respeta la organización", () => {
  assert.match(sql, /drop policy if exists tesoreria_directivos_ver_comprobantes/);
  assert.match(sql, /private\.has_org_role\(comprobacion\.organization_id/);
  assert.match(sql, /private\.has_org_role\(movimiento\.organization_id/);
});

test("solo funciones autenticadas pueden escribir o revisar", () => {
  assert.match(sql, /revoke all on function public\.registrar_comprobacion_retiro_efectivo[\s\S]+from public/);
  assert.match(sql, /grant execute on function public\.revisar_comprobacion_retiro_efectivo[\s\S]+to authenticated/);
  assert.match(sql, /split_part\(p_evidencia_path,'\/',1\).*auth\.uid/);
});
