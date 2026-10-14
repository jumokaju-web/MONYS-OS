import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migracion = await readFile(new URL(
  "../../supabase/migrations/20261014235500_flotilla_ajustes_prefactura.sql",
  import.meta.url,
), "utf8");

test("los ajustes de prefactura excluyen PNR para no duplicar el saldo", () => {
  assert.match(migracion, /create table if not exists public\.flotilla_prefactura_ajustes/i);
  assert.match(migracion, /categoria in \('NO_SHOW', 'SINIESTRO', 'PENALIZACION', 'FONDO_UNIDAD'\)/i);
  assert.doesNotMatch(migracion, /categoria in \([^)]*PNR/i);
  assert.match(migracion, /where estado='APLICADO'/i);
});

test("sólo Mónica o Administración de Flotilla gestionan y nadie borra ajustes", () => {
  assert.match(migracion, /flotilla_puede_gestionar_pnr\(v_unidad\.organization_id\)/i);
  assert.match(migracion, /flotilla_puede_gestionar_pnr\(v_ajuste\.organization_id\)/i);
  assert.match(migracion, /revoke all on public\.flotilla_prefactura_ajustes from anon, authenticated/i);
  assert.match(migracion, /grant select on public\.flotilla_prefactura_ajustes to authenticated/i);
  assert.doesNotMatch(migracion, /grant (insert|update|delete)[^;]*flotilla_prefactura_ajustes/i);
  assert.doesNotMatch(migracion, /delete from public\.flotilla_prefactura_ajustes/i);
});

test("el fondo exige número y total de parcialidades", () => {
  assert.match(migracion, /p_categoria = 'FONDO_UNIDAD'[\s\S]*p_numero_parcialidad[\s\S]*p_total_parcialidades/i);
  assert.match(migracion, /p_numero_parcialidad > p_total_parcialidades/i);
});

