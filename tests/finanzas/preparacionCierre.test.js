import test from "node:test";
import assert from "node:assert/strict";
import { prepararRutaCierre } from "../../src/features/finanzas/utils/preparacionCierre.js";
import { resumirCentroDecisionesFinancieras } from "../../src/features/finanzas/utils/centroDecisionesFinancieras.js";

const sucursales = ["a", "b"].map((id) => ({ id, ventasTotales: 1000, utilidadTotal: 400,
  periodo: { fechaInicial: "2026-10-19", fechaFinal: "2026-10-25" } }));
const expediente = { periodoValido: true, desde: "2026-10-19", hasta: "2026-10-25",
  banco: { revisionId: "r1", desdeObservado: "2026-09-01", hastaObservado: "2026-09-30" },
  cobros: { cantidad: 2, pendientes: 2, fechasPendientes: 0, importesPendientes: 0 } };

test("prepara una ruta de continuación sin afirmar que el banco anterior concilia la semana", () => {
  const plan = prepararRutaCierre({ sucursales, movimientos: [], expediente, estadoExpediente: "consultado", negocioEncontrado: true });
  assert.equal(plan.semanaValida, true);
  assert.equal(plan.pasos[0].estado, "CARGADO");
  assert.equal(plan.pasos[1].estado, "PENDIENTE");
  assert.match(plan.pasos[1].detalle, /2026-09-01/);
  assert.match(plan.pasos[1].detalle, /No muestran todo el corte/);
  assert.equal(plan.pasos[2].estado, "PENDIENTE");
  assert.equal(plan.pasos[3].estado, "REVISAR");
  assert.match(plan.pasos[3].detalle, /cero pendientes no significa cierre completo/);
});

test("las fechas observadas de un banco no certifican integridad ni cierre", () => {
  const plan = prepararRutaCierre({ sucursales, movimientos: [], expediente: { ...expediente,
    banco: { revisionId: "r2", desdeObservado: "2026-10-01", hastaObservado: "2026-10-31" } }, estadoExpediente: "consultado", negocioEncontrado: true });
  assert.equal(plan.pasos[1].estado, "REVISAR");
  assert.match(plan.pasos[1].detalle, /todas las cuentas y movimientos/);
});

test("no usa un expediente de otro corte ni una consulta fallida como fuente vacía", () => {
  for (const opciones of [{ estadoExpediente: "error" }, { expediente: { ...expediente, desde: "2026-10-12", hasta: "2026-10-18" } }, { negocioEncontrado: false }]) {
    const plan = prepararRutaCierre({ sucursales, movimientos: [], expediente, estadoExpediente: "consultado", negocioEncontrado: true, ...opciones });
    assert.equal(plan.pasos[1].estado, "POR_CONSULTAR");
    assert.equal(plan.pasos[2].estado, "POR_CONSULTAR");
    assert.doesNotMatch(plan.pasos[2].detalle, /0 cobros/);
  }
});

test("consulta pendiente o fallida conserva movimientos desconocidos tanto en preparación como Dirección", () => {
  for (const flags of [{ cargandoMovimientos: true }, { errorMovimientos: true }]) {
    const plan = prepararRutaCierre({ sucursales, movimientos: [], ...flags });
    assert.equal(plan.pendientes, null);
    assert.equal(plan.pasos[3].estado, "POR_CONSULTAR");
    const direccion = resumirCentroDecisionesFinancieras({ movimientos: [], ...flags });
    assert.equal(direccion.pendientes, null);
    assert.equal(direccion.totalMovimientos, null);
    assert.equal(direccion.prioridad.destino, "reintentar");
  }
});

test("cuenta solo pendientes del corte con fecha operativa México y expone registros sin fecha", () => {
  const plan = prepararRutaCierre({ sucursales, movimientos: [
    { estado: "Pendiente de revisión", fecha: "2026-10-19T02:00:00Z" },
    { estado: "Pendiente de revisión", fecha: "2026-10-26T02:00:00Z" },
    { estado: "Revisado", fecha: "2026-10-20" },
    { estado: "Pendiente de revisión" },
  ] });
  assert.equal(plan.pendientes, 1);
  assert.equal(plan.sinFecha, 1);
  assert.match(plan.pasos[3].detalle, /registros sin fecha/);
});

test("cortes distintos o una sola tienda no se muestran como una semana consolidada", () => {
  for (const lista of [sucursales.slice(0, 1), [sucursales[0], { ...sucursales[1], periodo: { fechaInicial: "2026-10-12", fechaFinal: "2026-10-18" } }]]) {
    const plan = prepararRutaCierre({ sucursales: lista, movimientos: [] });
    assert.equal(plan.semanaValida, false);
    assert.equal(plan.desde, null);
    assert.equal(plan.pendientes, null);
    assert.equal(plan.pasos[0].estado, "PENDIENTE");
  }
});
