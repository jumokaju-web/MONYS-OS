import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migracion = await readFile(new URL(
  "../../supabase/migrations/20261014223000_flotilla_control_pnr.sql",
  import.meta.url,
), "utf8");

test("crea expedientes, evidencias y descuentos PNR separados", () => {
  assert.match(migracion, /create table if not exists public\.flotilla_pnr_expedientes/i);
  assert.match(migracion, /create table if not exists public\.flotilla_pnr_evidencias/i);
  assert.match(migracion, /create table if not exists public\.flotilla_pnr_descuentos/i);
  assert.match(migracion, /unique \(organization_id, paquete_id\)/i);
});

test("el driver puede responder pero no cerrar ni borrar el PNR", () => {
  assert.match(migracion, /driver_auth_user_id is distinct from \(select auth\.uid\(\)\)/i);
  assert.match(migracion, /Solo Chory o Mónica pueden gestionar este PNR/i);
  assert.match(migracion, /flotilla_puede_gestionar_pnr/i);
  assert.match(migracion, /usuario\.role = 'owner'[\s\S]*acceso\.tipo_acceso = 'ADMIN_FLOTILLA'/i);
  assert.match(migracion, /revoke all on public\.flotilla_pnr_expedientes[\s\S]*from authenticated/i);
  assert.doesNotMatch(migracion, /grant (update|delete)[^;]*flotilla_pnr/i);
});

test("Mónica autoriza penalidad y convenio dentro de la organización", () => {
  assert.match(migracion, /organization_id = v_pnr\.organization_id/i);
  assert.match(migracion, /Mónica debe autorizar la penalidad/i);
  assert.match(migracion, /Mónica debe autorizar el convenio/i);
  assert.match(migracion, /v_pnr\.estado <> 'PENALIDAD_PROPUESTA'/i);
  assert.match(migracion, /v_pnr\.estado <> 'CONVENIO_SOLICITADO'/i);
});

test("cada abono es un solo movimiento compartido por socio y chofer", () => {
  assert.match(migracion, /aplica_socio boolean not null default true/i);
  assert.match(migracion, /aplica_chofer boolean not null default true/i);
  assert.match(migracion, /p_monto,true,true,'APLICADO'/i);
  assert.match(migracion, /set saldo=saldo-p_monto/i);
});

test("las políticas de evidencias usan EXISTS válido", () => {
  assert.doesNotMatch(migracion, /existeS\s*\(/);
  assert.match(migracion, /create policy flotilla_pnr_evidencias_insert[\s\S]*exists\(select 1/i);
});
