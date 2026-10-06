import assert from "node:assert/strict";
import test from "node:test";
import { calcularResumenDeudas } from "../../src/features/inteligencia/shared/resumenDeudas.js";

test("suma créditos activos y reestructurados, y excluye los cerrados", () => {
  const resumen = calcularResumenDeudas([
    {
      estado: "ACTIVA",
      saldo_actual: "100000",
      pago_mensual: "32000",
      tasa_anual: "24.5",
    },
    {
      estado: " reestructurada ",
      saldo_actual: 50000,
      pago_mensual: 8000,
      tasa_anual: 18,
    },
    {
      estado: "LIQUIDADA",
      saldo_actual: 9000,
      pago_mensual: 900,
      tasa_anual: 10,
    },
    {
      estado: "CANCELADA",
      saldo_actual: 7000,
      pago_mensual: 700,
      tasa_anual: 9,
    },
  ]);

  assert.deepEqual(resumen, {
    cantidad: 2,
    saldoTotal: 150000,
    pagoMensualTotal: 40000,
    sinTasa: 0,
    sinPagoMensual: 0,
  });
});

test("marca mensualidad y tasa faltantes sin ocultar el saldo", () => {
  const resumen = calcularResumenDeudas([
    {
      estado: "ACTIVA",
      saldo_actual: 12500,
      pago_mensual: null,
      tasa_anual: "",
    },
  ]);

  assert.deepEqual(resumen, {
    cantidad: 1,
    saldoTotal: 12500,
    pagoMensualTotal: 0,
    sinTasa: 1,
    sinPagoMensual: 1,
  });
});

test("devuelve ceros para entradas que no son una lista", () => {
  assert.deepEqual(calcularResumenDeudas(null), {
    cantidad: 0,
    saldoTotal: 0,
    pagoMensualTotal: 0,
    sinTasa: 0,
    sinPagoMensual: 0,
  });
});
