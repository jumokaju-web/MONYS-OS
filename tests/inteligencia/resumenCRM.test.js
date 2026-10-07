import test from "node:test";
import assert from "node:assert/strict";
import { resumirCRM } from "../../src/features/inteligencia/shared/resumenCRM.js";

test("el resumen separa oportunidades abiertas, seguimientos vencidos y monto estimado", () => {
  const resumen = resumirCRM([
    { etapa: "NUEVO", monto_estimado: 1200, proximo_seguimiento: "2026-10-06" },
    { etapa: "COTIZANDO", monto_estimado: null, proximo_seguimiento: "2026-10-07" },
    { etapa: "GANADO", monto_estimado: 7000, proximo_seguimiento: "2026-10-01" },
    { etapa: "PERDIDO", monto_estimado: 900, proximo_seguimiento: "2026-10-06" },
  ], "2026-10-07");
  assert.deepEqual(resumen, {
    total: 4,
    abiertas: 2,
    porEtapa: { NUEVO: 1, CONTACTADO: 0, COTIZANDO: 1, GANADO: 1, PERDIDO: 1 },
    ganadas: 1,
    perdidas: 1,
    tasaCierre: 50,
    seguimientosPendientes: 2,
    pipelineEstimado: 1200,
    montoConocido: 1,
  });
});

test("el cero es un monto capturado y nunca contamina el embudo", () => {
  const resumen = resumirCRM([
    { etapa: "NUEVO", monto_estimado: 0, proximo_seguimiento: null },
  ], "2026-10-07");
  assert.equal(resumen.pipelineEstimado, 0);
  assert.equal(resumen.montoConocido, 1);
});

test("sin oportunidades cerradas la tasa de cierre queda como dato pendiente", () => {
  const resumen = resumirCRM([{ etapa: "NUEVO", monto_estimado: null }], "2026-10-07");
  assert.equal(resumen.tasaCierre, null);
  assert.equal(resumen.porEtapa.NUEVO, 1);
});
