import test from "node:test";
import assert from "node:assert/strict";
import { resumirObligacionesOperativas } from "../../src/features/finanzas/utils/obligacionesOperativas.js";

test("suma solo el saldo pendiente de obligaciones vencidas o próximas", () => {
  const resumen = resumirObligacionesOperativas({
    consultadas: true,
    hoy: "2026-10-26",
    obligaciones: [
      { id: "renta", importe: 7000, fecha_vencimiento: "2026-10-25", pagos: [{ importe: 2000 }] },
      { id: "luz", importe: 1200, fecha_vencimiento: "2026-10-30", pagos: [] },
      { id: "predial", importe: 500, fecha_vencimiento: "2026-11-05", pagos: [] },
      { id: "cancelada", importe: 900, fecha_vencimiento: "2026-10-27", estado: "CANCELADA", pagos: [] },
    ],
  });
  assert.equal(resumen.completas, true);
  assert.equal(resumen.totalPendiente, 6700);
  assert.equal(resumen.compromisos7Dias, 6200);
  assert.equal(resumen.filas.find((fila) => fila.id === "renta").vencida, true);
});

test("no convierte una consulta fallida en cero obligaciones", () => {
  const resumen = resumirObligacionesOperativas({ obligaciones: [], consultadas: false, hoy: "2026-10-26" });
  assert.equal(resumen.totalPendiente, null);
  assert.equal(resumen.compromisos7Dias, null);
});

test("bloquea dinero libre mientras una obligación recurrente no proyecta el siguiente vencimiento", () => {
  const resumen = resumirObligacionesOperativas({
    consultadas: true,
    hoy: "2026-10-26",
    obligaciones: [
      { id: "renta", importe: 7000, fecha_vencimiento: "2026-11-01", frecuencia: "MENSUAL", pagos: [] },
    ],
  });
  assert.equal(resumen.frecuenciasNoProyectadas, 1);
  assert.equal(resumen.completas, false);
  assert.equal(resumen.totalPendiente, null);
  assert.equal(resumen.compromisos7Dias, null);
});

test("bloquea importes faltantes, fechas imposibles y sobrepagos", () => {
  const resumen = resumirObligacionesOperativas({
    consultadas: true,
    hoy: "2026-10-26",
    obligaciones: [
      { importe: null, fecha_vencimiento: "2026-10-27", pagos: [] },
      { importe: 500, fecha_vencimiento: "2026-02-30", pagos: [] },
      { importe: 100, fecha_vencimiento: "2026-10-27", pagos: [{ importe: 125 }] },
    ],
  });
  assert.equal(resumen.completas, false);
  assert.equal(resumen.totalPendiente, null);
  assert.equal(resumen.incompletas, 3);
  assert.equal(resumen.sobrepagadas, 1);
});
