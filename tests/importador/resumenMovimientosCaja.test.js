import test from "node:test";
import assert from "node:assert/strict";
import { generarResumenMovimientosCaja } from "../../src/features/importador/utils/resumenMovimientosCaja.js";

test("separa entradas y salidas por forma de pago sin llamar pago a proveedor", () => {
  const resumen = generarResumenMovimientosCaja([
    { tipoMovimiento: "SALIDA", metodoPago: "CH", monto: 30000, fecha: 46314, caja: "Caja 1", comentario: "" },
    { tipoMovimiento: "SALIDA", metodoPago: "CH", monto: 20000, fecha: 46314, caja: "Caja 1", comentario: "Pink Up" },
    { tipoMovimiento: "ENTRADA", metodoPago: "EF", monto: 1000 },
    { tipoMovimiento: "SALIDA", metodoPago: "EF", monto: 120 },
  ]);

  assert.equal(resumen.totalSalidasCheque, 50000);
  assert.equal(resumen.chequesSinConcepto, 1);
  assert.equal(resumen.salidasCheque[0].fecha, "2026-10-19");
  assert.equal(resumen.salidasCheque.find((fila) => fila.monto === 20000).conceptoRegistrado, true);
  assert.deepEqual(resumen.grupos.map(({ tipo, metodo, movimientos, importe }) => ({ tipo, metodo, movimientos, importe })), [
    { tipo: "ENTRADA", metodo: "Efectivo", movimientos: 1, importe: 1000 },
    { tipo: "SALIDA", metodo: "Cheque", movimientos: 2, importe: 50000 },
    { tipo: "SALIDA", metodo: "Efectivo", movimientos: 1, importe: 120 },
  ]);
});

test("ignora filas que no sean entradas o salidas y no inventa cheques", () => {
  const resumen = generarResumenMovimientosCaja([
    { tipoMovimiento: "", metodoPago: "CH", monto: 500 },
    { tipoMovimiento: "SALIDA", metodoPago: "EF", monto: 50 },
  ]);

  assert.equal(resumen.totalSalidasCheque, 0);
  assert.equal(resumen.salidasCheque.length, 0);
  assert.equal(resumen.grupos.length, 1);
});

test("cuenta la descripción como concepto cuando SICAR no trae comentario", () => {
  const resumen = generarResumenMovimientosCaja([
    { tipoMovimiento: "SALIDA", metodoPago: "CH", monto: 250, fecha: 46314, descripcion: "Pago Pink Up" },
  ]);

  assert.equal(resumen.salidasCheque[0].concepto, "Pago Pink Up");
  assert.equal(resumen.salidasCheque[0].conceptoRegistrado, true);
  assert.equal(resumen.chequesSinConcepto, 0);
});
