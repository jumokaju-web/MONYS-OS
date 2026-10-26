import test from "node:test";
import assert from "node:assert/strict";
import { integrarComprobacionesRetiros, validarReporteRetiro } from "../../src/features/finanzas/utils/comprobacionRetiros.js";

const retiro = { cierreId: "c1", cajaId: "CAJA_1", monto: 800, estado: "IDENTIFICADO" };

test("reportado no equivale a comprobado", () => {
  const resumen = integrarComprobacionesRetiros([retiro], [{ cierre_id: "c1", caja_id: "CAJA_1", version: 1, estado: "REPORTADO" }]);
  assert.equal(resumen.reportados, 1);
  assert.equal(resumen.comprobados, 0);
  assert.equal(resumen.completo, false);
});

test("conserva solo la versión más reciente de la revisión", () => {
  const resumen = integrarComprobacionesRetiros([retiro], [
    { cierre_id: "c1", caja_id: "CAJA_1", version: 1, estado: "REPORTADO" },
    { cierre_id: "c1", caja_id: "CAJA_1", version: 2, estado: "COMPROBADO" },
  ]);
  assert.equal(resumen.comprobados, 1);
  assert.equal(resumen.filas[0].comprobacion.version, 2);
});

test("un retiro sin cierre individual permanece pendiente", () => {
  const resumen = integrarComprobacionesRetiros([{ cajaId: "TOTAL", monto: 900 }], []);
  assert.equal(resumen.pendientes, 1);
  assert.equal(resumen.completo, false);
});

test("exige destino, referencia y evidencia", () => {
  assert.match(validarReporteRetiro({ retiro }), /destino|dónde/i);
  assert.match(validarReporteRetiro({ retiro, destinoReal: "BBVA" }), /referencia/i);
  assert.match(validarReporteRetiro({ retiro, destinoReal: "BBVA", referencia: "123" }), /Adjunta/i);
  assert.equal(validarReporteRetiro({ retiro, destinoReal: "BBVA", referencia: "123", evidencia: { size: 100 } }), null);
});
