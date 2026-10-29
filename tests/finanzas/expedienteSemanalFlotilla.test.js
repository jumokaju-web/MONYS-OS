import test from "node:test";
import assert from "node:assert/strict";
import { resumirExpedienteSemanalFlotilla } from "../../src/features/finanzas/utils/expedienteSemanalFlotilla.js";

const semana = { desde: "2026-10-19", hasta: "2026-10-25" };
const factura = (cambios = {}) => ({ id: "f1", organization_id: "org1", business_id: "flotilla", periodo_desde: "2026-10-12", periodo_hasta: "2026-10-18",
  total: 1160, estado_pago: "PAGADA", pagada_en: "2026-10-23T18:00:00Z", estado_conciliacion: "PENDIENTE", ...cambios });
const evidencia = () => ({
  revisionBancaria: { id: "r1", organization_id: "org1", business_id: "tienda", paquete: { cuentas: [{ desde: "2026-10-01", hasta: "2026-10-31" }],
    movimientos: [{ id: "b1", fecha_operacion: "2026-10-23", abono: 1160, cargo: 0 }] } },
  conciliaciones: [{ id: "c1", organization_id: "org1", business_id: "tienda", revision_bancaria_id: "r1", banco_movimiento_id: "b1", cash_movement_id: "t1",
    monto: 1160, direccion: "ENTRADA", estado: "ACTIVA" }],
  movimientosTesoreria: [{ id: "t1", organization_id: "org1", business_id: "flotilla", account_id: "a1",
    movement_type: "ENTRADA", status: "Revisado", amount: 1160, occurred_at: "2026-10-23T18:00:00Z" }],
});

test("cobros octubre de servicios anteriores se muestran sin sumar factura como segundo ingreso", () => {
  const resultado = resumirExpedienteSemanalFlotilla({ ...semana,
    facturas: [factura(), factura({ id: "f2", total: 2320 })],
    revisionBancaria: { id: "septiembre", paquete: { movimientos: [
      { id: "sept1", fecha_operacion: "2026-09-01", abono: 1160 },
      { id: "sept30", fecha_operacion: "2026-09-30", abono: 2320 },
    ] } },
  });
  assert.equal(resultado.servicio.cantidad, 0);
  assert.equal(resultado.servicio.total, 0);
  assert.equal(resultado.cobros.total, 3480);
  assert.equal(resultado.cobros.cantidad, 2);
  assert.equal(resultado.cobros.pendientes, 2);
  assert.equal(resultado.cobros.totalConciliado, 0);
  assert.equal(resultado.banco.desdeObservado, "2026-09-01");
  assert.equal(resultado.banco.hastaObservado, "2026-09-30");
  assert.equal(resultado.banco.coberturaCompletaConfirmada, false);
  assert(resultado.cobros.filas.every((fila) => fila.estadoEvidencia === "PENDIENTE_EVIDENCIA"));
});

test("estado CONCILIADA solo no certifica; requiere vínculo activo y abono verificable", () => {
  const declarada = factura({ estado_conciliacion: "CONCILIADA", cuenta_id: "a1", movimiento_tesoreria_id: "t1" });
  assert.equal(resumirExpedienteSemanalFlotilla({ ...semana, facturas: [declarada] }).cobros.conciliados, 0);
  const resultado = resumirExpedienteSemanalFlotilla({ ...semana, facturas: [declarada], ...evidencia() });
  assert.equal(resultado.cobros.conciliados, 1);
  assert.equal(resultado.cobros.totalConciliado, 1160);
  assert.equal(resultado.cobros.filas[0].estadoEvidencia, "CONCILIADA_CON_EVIDENCIA");
  assert.equal(resultado.banco.desdeObservado, "2026-10-23");
  assert.equal(resultado.banco.hastaObservado, "2026-10-23");
  assert.equal(resultado.banco.coberturaCompletaConfirmada, false);
});

test("revisión ajena, anulación, otro importe, sin ID o evidencia compartida no certifican el cobro", () => {
  const base = factura({ estado_conciliacion: "CONCILIADA", cuenta_id: "a1", movimiento_tesoreria_id: "t1" });
  for (const mutar of [
    (args) => { args.conciliaciones[0].revision_bancaria_id = "otra"; },
    (args) => { args.conciliaciones[0].estado = "ANULADA"; },
    (args) => { args.revisionBancaria.paquete.movimientos[0].abono = 1159.99; },
    (args) => { args.conciliaciones[0].monto = 1100; },
    (args) => { args.facturas[0].id = null; },
    (args) => { args.revisionBancaria.organization_id = "otra-org"; },
    (args) => { delete args.revisionBancaria.organization_id; },
    (args) => { args.conciliaciones[0].organization_id = "otra-org"; },
    (args) => { args.movimientosTesoreria = []; },
    (args) => { args.movimientosTesoreria[0].organization_id = "otra-org"; },
    (args) => { args.movimientosTesoreria[0].business_id = "tienda"; },
    (args) => { args.movimientosTesoreria[0].account_id = "otra-cuenta"; },
    (args) => { args.movimientosTesoreria[0].movement_type = "SALIDA"; },
    (args) => { args.movimientosTesoreria[0].amount = 1159.99; },
    (args) => { args.movimientosTesoreria[0].status = "Cancelado"; },
    (args) => { args.movimientosTesoreria[0].status = "Pendiente de revisión"; },
    (args) => { args.movimientosTesoreria[0].occurred_at = "2026-10-20T18:00:00Z"; },
    (args) => { args.movimientosTesoreria.push({ ...args.movimientosTesoreria[0] }); },
    (args) => { args.facturas.push(factura({ ...base, id: "f2" })); },
    (args) => { args.conciliaciones.push({ ...args.conciliaciones[0], id: "c2", cash_movement_id: "t2" }); },
  ]) {
    const args = { ...semana, facturas: [{ ...base }], ...evidencia() };
    mutar(args);
    const resultado = resumirExpedienteSemanalFlotilla(args);
    assert.equal(resultado.cobros.conciliados, 0);
    assert.equal(resultado.cobros.pendientes, resultado.cobros.cantidad);
  }
});

test("documentos duplicados no duplican cobro y canceladas quedan excluidas", () => {
  const documento = factura();
  const resultado = resumirExpedienteSemanalFlotilla({ ...semana,
    facturas: [documento, { ...documento }, factura({ id: "cancelada", estado_pago: "CANCELADA" })],
  });
  assert.equal(resultado.duplicadosExcluidos, 1);
  assert.equal(resultado.canceladasExcluidas, 1);
  assert.equal(resultado.cobros.cantidad, 1);
  assert.equal(resultado.cobros.total, 1160);
});

test("importe desconocido, versiones contradictorias y servicio parcial conservan totales pendientes", () => {
  const resultado = resumirExpedienteSemanalFlotilla({ ...semana,
    facturas: [factura({ periodo_desde: "2026-10-18", periodo_hasta: "2026-10-22", total: null })],
  });
  assert.equal(resultado.servicio.cantidad, 1);
  assert.equal(resultado.servicio.total, null);
  assert.equal(resultado.servicio.periodosParciales, 1);
  assert.equal(resultado.cobros.total, null);
  assert.equal(resultado.cobros.filas[0].estadoEvidencia, "IMPORTE_PENDIENTE");
  const conflicto = resumirExpedienteSemanalFlotilla({ ...semana, facturas: [factura(), factura({ total: 1 })] });
  assert.equal(conflicto.cobros.total, null);
  assert.equal(conflicto.identidadPendiente, 1);
  assert.equal(conflicto.cobros.filas[0].estadoEvidencia, "IDENTIDAD_PENDIENTE");
});

test("pagada_en se evalúa en México y no se prorratea un documento de servicio solapado", () => {
  const resultado = resumirExpedienteSemanalFlotilla({ ...semana, facturas: [
    factura({ id: "fuera", pagada_en: "2026-10-19T02:00:00Z" }),
    factura({ id: "dentro", pagada_en: "2026-10-26T02:00:00Z", periodo_desde: "2026-10-18", periodo_hasta: "2026-10-22" }),
  ] });
  assert.equal(resultado.cobros.cantidad, 1);
  assert.equal(resultado.cobros.filas[0].fechaCobro, "2026-10-25");
  assert.equal(resultado.servicio.total, null);
  assert.equal(resultado.servicio.filas[0].montoDocumento, 1160);
});

test("sin periodo semanal válido no convierte la ausencia de filas en cero confirmado", () => {
  const resultado = resumirExpedienteSemanalFlotilla({ desde: "2026-10-20", hasta: "2026-10-25", facturas: [factura()] });
  assert.equal(resultado.periodoValido, false);
  assert.equal(resultado.servicio.total, null);
  assert.equal(resultado.cobros.total, null);
});

test("cuenta compartida permite revisión de tienda y cash vigente de Flotilla por fecha de liquidación", () => {
  const args = { ...semana, facturas: [factura({ estado_conciliacion: "CONCILIADA", cuenta_id: "a1", movimiento_tesoreria_id: "t1" })], ...evidencia() };
  args.revisionBancaria.paquete.movimientos[0].fecha_liquidacion = "2026-10-24";
  args.movimientosTesoreria[0].occurred_at = "2026-10-24T18:00:00Z";
  const resultado = resumirExpedienteSemanalFlotilla(args);
  assert.equal(resultado.cobros.conciliados, 1);
  assert.notEqual(args.revisionBancaria.business_id, args.movimientosTesoreria[0].business_id);
});

test("snapshot revisado no reemplaza movimiento vigente cancelado ni la identidad de organización", () => {
  const args = { ...semana, facturas: [factura({ estado_conciliacion: "CONCILIADA", cuenta_id: "a1", movimiento_tesoreria_id: "t1" })], ...evidencia() };
  args.conciliaciones[0].snapshot = { movimiento: { ...args.movimientosTesoreria[0] } };
  args.movimientosTesoreria[0].status = "Cancelado";
  assert.equal(resumirExpedienteSemanalFlotilla(args).cobros.conciliados, 0);
  args.movimientosTesoreria[0].status = "Revisado";
  delete args.facturas[0].organization_id;
  assert.equal(resumirExpedienteSemanalFlotilla(args).cobros.conciliados, 0);
});
