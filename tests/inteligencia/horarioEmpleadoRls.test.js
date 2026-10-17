import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20261017180000_horarios_flexibles_empleados.sql", import.meta.url),
  "utf8",
);

test("el calendario separa semana base y cambios por fecha con RLS", () => {
  assert.match(sql, /create table if not exists public\.empleado_horario_semanal/i);
  assert.match(sql, /create table if not exists public\.empleado_horario_excepcion/i);
  assert.match(sql, /alter table public\.empleado_horario_semanal enable row level security/i);
  assert.match(sql, /alter table public\.empleado_horario_excepcion enable row level security/i);
  assert.match(sql, /unique \(empleado_id, dia_semana\)/i);
  assert.match(sql, /unique \(empleado_id, fecha\)/i);
});

test("solo Dirección escribe y cada cambio conserva autor", () => {
  assert.match(sql, /u\.role in \('owner', 'director', 'admin', 'rh'\)/i);
  assert.match(sql, /changed_by = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on public\.empleado_horario_semanal from anon/i);
  assert.match(sql, /revoke all on public\.empleado_horario_excepcion from anon/i);
});
