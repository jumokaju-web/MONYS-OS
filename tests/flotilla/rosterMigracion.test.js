import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20261013033000_flotilla_roster_confirmado.sql", import.meta.url),
  "utf8"
);

test("el roster configura las seis unidades confirmadas sin guardar CURP", () => {
  for (const placa of ["JY13117", "HU4027A", "JY21009", "HU1812B", "LG44598", "LG67379"]) {
    assert.match(sql, new RegExp(`'${placa}'`));
  }
  assert.doesNotMatch(sql, /CURP:\s*['"][A-Z0-9]/i);
  assert.doesNotMatch(sql, /JIMA901023|JIMM890315|VAFJ990910|PISL880212|FECR040524|COOP811112/);
});

test("el roster conserva MLP, Rental Small, Rental Large y administración acordada", () => {
  assert.match(sql, /'JY13117',[\s\S]*?'MLP', true/);
  assert.match(sql, /'HU4027A',[\s\S]*?'MLP', false/);
  assert.match(sql, /'LG44598',[\s\S]*?'RENTAL_SMALL', false/);
  assert.match(sql, /'LG67379',[\s\S]*?'RENTAL_LARGE', false/);
  assert.match(sql, /RAM se conserva sin asignación/);
});
