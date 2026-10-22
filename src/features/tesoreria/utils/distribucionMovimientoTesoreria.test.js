import test from "node:test";
import assert from "node:assert/strict";
import { validarDistribucionMovimiento } from "./distribucionMovimientoTesoreria.js";

const destinosValidos = [
  { business_id: "monys", branch_id: "centro" },
  { business_id: "monys", branch_id: "anaya" },
  { business_id: "flotilla", branch_id: "no-aplica" },
];

test("distribuye un pago mixto hasta el centavo sin alterar su total original", () => {
  const resultado = validarDistribucionMovimiento({
    montoTotal: 30000,
    destinosValidos,
    partidas: [
      { business_id: "monys", branch_id: "centro", amount: 18000, expense_category: "nomina", expense_behavior: "fijo" },
      { business_id: "monys", branch_id: "anaya", amount: 7000, expense_category: "renta", expense_behavior: "fijo" },
      { business_id: "flotilla", branch_id: "no-aplica", amount: 5000, expense_category: "servicios", expense_behavior: "variable" },
    ],
  });

  assert.equal(resultado.valida, true);
  assert.equal(resultado.partidas.reduce((suma, partida) => suma + partida.amount, 0), 30000);
  assert.equal(resultado.partidas.length, 3);
});

test("rechaza un desglose que no coincide exactamente con el pago", () => {
  const resultado = validarDistribucionMovimiento({
    montoTotal: 30000,
    destinosValidos,
    partidas: [
      { business_id: "monys", branch_id: "centro", amount: 19999.99, expense_category: "nomina", expense_behavior: "fijo" },
      { business_id: "monys", branch_id: "anaya", amount: 10000, expense_category: "renta", expense_behavior: "fijo" },
    ],
  });
  assert.equal(resultado.valida, false);
  assert.match(resultado.motivo, /deben sumar exactamente/);
});

test("rechaza negocios/sucursales inexistentes y gastos sin clasificación financiera", () => {
  const destinoInvalido = validarDistribucionMovimiento({
    montoTotal: 100,
    destinosValidos,
    partidas: [
      { business_id: "monys", branch_id: "no-aplica", amount: 100, expense_category: "renta", expense_behavior: "fijo" },
    ],
  });
  assert.equal(destinoInvalido.valida, false);

  const gastoSinClasificar = validarDistribucionMovimiento({
    montoTotal: 100,
    destinosValidos,
    partidas: [
      { business_id: "monys", branch_id: "centro", amount: 100, expense_category: "renta", expense_behavior: "no_aplica" },
    ],
  });
  assert.equal(gastoSinClasificar.valida, false);
  assert.match(gastoSinClasificar.motivo, /fijo o variable/);
});
