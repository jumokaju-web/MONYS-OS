import test from "node:test";
import assert from "node:assert/strict";
import { resumirFlujoFlotilla } from "../../src/features/dashboard/utils/resumenFlujoFlotilla.js";

test("separa entradas y salidas de Flotilla y excluye traspasos y movimientos cancelados", () => {
  const resumen = resumirFlujoFlotilla([
    { tipo: "ENTRADA", monto: 7000, concepto: "Renta flotilla" },
    { tipo: "ENTRADA", monto: 5000, concepto: "Traspaso recibido EOX", expense_category: "traspaso_caja" },
    { tipo: "SALIDA", monto: 5000, concepto: "Recarga EOX", expense_category: "traspaso_caja" },
    { tipo: "SALIDA", monto: 3862.65, concepto: "Gasolina EOX" },
    { tipo: "SALIDA", monto: 6472, expense_category: "pago_propietario_flotilla" },
    { tipo: "SALIDA", monto: 400, concepto: "Servicio de flotilla" },
    { tipo: "ENTRADA", monto: 9000, concepto: "Renta flotilla", status: "Cancelado" },
    { tipo: "ENTRADA", monto: 2000, concepto: "Venta de cosméticos" },
  ]);

  assert.deepEqual(resumen, {
    entradas: 7000,
    salidas: 10734.65,
    neto: -3734.65,
    movimientos: 4,
    traspasosExcluidos: 2,
  });
});
