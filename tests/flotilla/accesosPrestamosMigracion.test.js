import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gasolina = readFileSync(
  new URL("../../supabase/migrations/20261014031500_flotilla_gasolina_evidencia_prestamo.sql", import.meta.url),
  "utf8"
);
const accesos = readFileSync(
  new URL("../../supabase/migrations/20261014033000_flotilla_accesos_socios.sql", import.meta.url),
  "utf8"
);

test("gasolina requiere ticket y tablero antes y después", () => {
  assert.match(gasolina, /evidencia_ticket_path/);
  assert.match(gasolina, /evidencia_tablero_antes_path/);
  assert.match(gasolina, /evidencia_tablero_despues_path/);
  assert.match(gasolina, /GASOLINA_APROBADA/);
  assert.match(gasolina, /PRESTAMO_PERSONAL/);
});

test("el préstamo de gasolina usa una referencia única y se cancela al comprobarse", () => {
  assert.match(gasolina, /movimiento_gasolina_id uuid unique/);
  assert.match(gasolina, /GASOLINA_SIN_EVIDENCIA:/);
  assert.match(gasolina, /Gasolina comprobada con ticket y tableros aprobados/);
});

test("los accesos separan administrador de Flotilla y socios de consulta", () => {
  assert.match(accesos, /ADMIN_FLOTILLA/);
  assert.match(accesos, /SOCIO_CONSULTA/);
  assert.match(accesos, /flotilla_puede_ver_unidad/);
  assert.match(accesos, /configurar_permisos_usuario/);
  assert.doesNotMatch(accesos, /ver_finanzas[^\n]*true/);
});
