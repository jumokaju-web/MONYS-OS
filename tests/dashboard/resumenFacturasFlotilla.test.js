import test from "node:test";
import assert from "node:assert/strict";
import { resumirFacturasFlotilla } from "../../src/features/dashboard/utils/resumenFacturasFlotilla.js";

test("suma facturas de servicio y conserva separada la conciliación bancaria", () => {
  const resumen = resumirFacturasFlotilla([
    { total: "40364.52", estado_pago: "PAGADA", estado_conciliacion: "PENDIENTE" },
    { total: "23954.00", estado_pago: "PAGADA", estado_conciliacion: "PENDIENTE" },
    { total: "9000.00", estado_pago: "CANCELADA", estado_conciliacion: "PENDIENTE" },
  ]);
  assert.deepEqual(resumen, {
    cantidad: 2,
    totalFacturado: 64318.52,
    cantidadConciliada: 0,
    totalConciliado: 0,
    cantidadPendiente: 2,
  });
});
