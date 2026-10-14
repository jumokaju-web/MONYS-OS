import test from "node:test";
import assert from "node:assert/strict";
import { resumirPagosRH, saldoPorRecuperarMovimiento } from "../../src/features/inteligencia/shared/resumenPagosRH.js";

test("separa pendientes, pagos y saldos por recuperar sin descontar automáticamente", () => {
  const movimientos = [
    { tipo: "NOMINA", estado: "PENDIENTE", monto: 900 },
    { tipo: "NOMINA", estado: "PAGADO", monto: 800 },
    { tipo: "COMISION", estado: "PAGADO", monto: 125.5 },
    { tipo: "PRESTAMO", estado: "PAGADO", monto: 1000, recuperaciones: [{ monto: 250, estado: "VIGENTE" }] },
    { tipo: "ANTICIPO", estado: "ANULADO", monto: 300 },
  ];
  assert.deepEqual(resumirPagosRH(movimientos), {
    pendienteAutorizar: 900,
    nominaPagada: 800,
    comisionesPagadas: 125.5,
    porRecuperar: 750,
  });
});

test("ignora recuperaciones anuladas y nunca presenta saldo negativo", () => {
  assert.equal(saldoPorRecuperarMovimiento({
    tipo: "ANTICIPO", estado: "PAGADO", monto: 300,
    recuperaciones: [{ monto: 200, estado: "ANULADA" }, { monto: 500, estado: "VIGENTE" }],
  }), 0);
  assert.equal(saldoPorRecuperarMovimiento({ tipo: "PRESTAMO", estado: "PENDIENTE", monto: 300 }), 0);
});
