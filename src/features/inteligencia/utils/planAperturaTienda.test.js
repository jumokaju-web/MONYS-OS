import test from "node:test";
import assert from "node:assert/strict";
import { calcularEquilibrioDiario } from "./equilibrioDiario.js";
import { crearPlanAperturaTienda, GASTOS_MENSUALES_APERTURA } from "./planAperturaTienda.js";

test("crea tres etapas financieras para la nueva tienda", () => {
  const escenarios = crearPlanAperturaTienda(new Date("2026-11-11T18:00:00Z"));

  assert.equal(escenarios.length, 3);
  assert.equal(escenarios[0].mes, "2026-11");
  assert.equal(escenarios[0].datos.diasAbiertos, "30");
  assert.equal(Number(escenarios[0].datos.gastosFijos), Number(GASTOS_MENSUALES_APERTURA.toFixed(2)));
  assert.equal(escenarios[0].datos.deuda, "25000");
  assert.equal(escenarios[0].datos.ventaPrevista, "345000");
});

test("el escenario de arranque separa operación y pagos de deuda", () => {
  const [arranque] = crearPlanAperturaTienda(new Date("2026-11-11T18:00:00Z"));
  const resultado = calcularEquilibrioDiario(arranque.datos);

  assert.equal(resultado.calculable, true);
  assert.ok(resultado.operacionDiaria > 7500 && resultado.operacionDiaria < 7600);
  assert.ok(resultado.cajaDiaria > 9800 && resultado.cajaDiaria < 9900);
  assert.ok(resultado.brechaCajaDiaria === 0);
});
