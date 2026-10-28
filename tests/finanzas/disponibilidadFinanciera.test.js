import test from "node:test";
import assert from "node:assert/strict";
import { resumirDisponibilidadFinanciera } from "../../src/features/finanzas/utils/disponibilidadFinanciera.js";

const cierreCompleto = {
  cajasEsperadas: 3,
  cajasFaltantes: 0,
  cajasIncompletas: 0,
  efectivoFinal: 3000,
  efectivoEntregado: 8000,
  diferencias: 0,
};

const proveedoresConfirmados = {
  importacion: { id: "imp-1", created_at: "2026-10-15T12:00:00Z" },
  creditos: [{ saldo: 4000, fecha_vencimiento: "2026-10-18" }],
};

test("no usa como disponible un saldo bancario de otro día", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 9000, fechaSaldo: "2026-10-14T20:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.liquidezLocalizada, null);
  assert.equal(resumen.dineroLibre, null);
  assert.equal(resumen.prioridad.destino, "bancos");
});

test("muestra todos los bloqueos de datos a la vez y conserva cada destino", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-27",
    cuentas: [{ id: "b1", saldo: 9000, fechaSaldo: "2026-10-26T20:00:00-06:00" }],
    cierre: { cajasEsperadas: 2, cajasFaltantes: 1, cajasIncompletas: 1 },
    creditosProveedores: {},
    deudasFinancieras: [{ estado: "ACTIVA", nombre: "Crédito", pago_mensual: null }],
    deudasConsultadas: true,
    obligacionesOperativas: { completas: false },
  });

  assert.equal(resumen.dineroLibre, null);
  assert.deepEqual(resumen.faltantes.map(({ id }) => id), ["saldos", "cajas", "proveedores", "deudas", "operacion"]);
  assert.deepEqual(resumen.faltantes.map(({ destino }) => destino), ["bancos", "importador", "plan", "plan", "plan"]);
});

test("un movimiento bancario de hoy no vuelve confirmado un saldo capturado días antes", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{
      id: "b1",
      saldo: 9000,
      fechaSaldo: "2026-10-14T20:00:00-06:00",
      fechaActualizacion: "2026-10-15T09:00:00-06:00",
      esEstimado: true,
    }],
    cierre: cierreCompleto,
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.cuentasPendientes, 1);
  assert.equal(resumen.liquidezLocalizada, null);
  assert.equal(resumen.dineroLibre, null);
});

test("separa efectivo resguardado para evitar sumarlo dos veces", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.liquidezLocalizada, 13000);
  assert.equal(resumen.efectivoResguardado, 8000);
  assert.equal(resumen.dineroLibre, 9000);
  assert.equal(resumen.controlRetiros.pendientes, 1);
  assert.match(resumen.prioridad.titulo, /destino del efectivo retirado/i);
});

test("un proveedor sin vencimiento bloquea dinero libre aunque el saldo sea conocido", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: { id: "imp-1", created_at: "2026-10-15T12:00:00Z" },
      creditos: [{ saldo: 4000, fecha_vencimiento: null }],
    },
  });
  assert.equal(resumen.liquidezLocalizada, 13000);
  assert.equal(resumen.dineroLibre, null);
  assert.match(resumen.prioridad.titulo, /vencimientos/i);
});

test("un reporte antiguo de proveedores no libera dinero", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: { id: "imp-1", created_at: "2026-08-06T12:00:00Z" },
      creditos: [{ saldo: 4000, fecha_vencimiento: "2026-10-18" }],
    },
  });
  assert.equal(resumen.liquidezLocalizada, 13000);
  assert.equal(resumen.dineroLibre, null);
  assert.match(resumen.prioridad.titulo, /actualiza/i);
});

test("un saldo negativo de proveedor no reduce otras deudas ni libera dinero", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: { id: "imp-1", created_at: "2026-10-15T12:00:00Z" },
      creditos: [{ saldo: 4000, fecha_vencimiento: "2026-10-18" }, { saldo: -1000, fecha_vencimiento: "2026-10-18" }],
    },
  });
  assert.equal(resumen.proveedores.total, 4000);
  assert.equal(resumen.proveedores.saldosPendientes, 1);
  assert.equal(resumen.dineroLibre, null);
});

test("una fecha futura de reporte de proveedores no se toma como vigente", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: { id: "imp-1", created_at: "2026-10-16T12:00:00Z" },
      creditos: [],
    },
  });
  assert.equal(resumen.proveedores.vigente, false);
  assert.equal(resumen.dineroLibre, null);
});

test("acepta cero proveedores solo con confirmación vigente y conserva el saldo como cero", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: null,
      confirmacion: { fecha_corte: "2026-10-15", confirmado_en: "2026-10-15T12:00:00-06:00" },
      fuente: "confirmacion_cero",
      disponible: true,
      creditos: [],
      saldoTotal: 0,
    },
  });
  assert.equal(resumen.proveedores.disponible, true);
  assert.equal(resumen.proveedores.vigente, true);
  assert.equal(resumen.proveedores.total, 0);
  assert.equal(resumen.dineroLibre, 13000);
});

test("un cero confirmado en una sucursal no cubre otra sucursal sin reporte", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: null,
      confirmacion: { fecha_corte: "2026-10-15" },
      fuente: "confirmacion_cero",
      fuenteCompleta: false,
      disponible: true,
      creditos: [],
      saldoTotal: 0,
    },
  });
  assert.equal(resumen.proveedores.disponible, false);
  assert.equal(resumen.proveedores.vigente, false);
  assert.equal(resumen.dineroLibre, null);
});

test("un cierre incompleto no se sustituye por efectivo cero", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, cajasIncompletas: 1, efectivoFinal: 0 },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.efectivoCajas, null);
  assert.equal(resumen.liquidezLocalizada, null);
  assert.equal(resumen.prioridad.destino, "importador");
});

test("prefiere el corte oficial y separa el efectivo retirado", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    cortesOficiales: {
      completo: true,
      cajasEsperadas: 3,
      efectivoEnCaja: 1250,
      efectivoRetirado: 9750,
      diferencias: 0,
    },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.fuenteCajas, "SICAR_OFICIAL");
  assert.equal(resumen.efectivoCajas, 1250);
  assert.equal(resumen.efectivoResguardado, 9750);
  assert.equal(resumen.liquidezLocalizada, 11250);
  assert.equal(resumen.dineroLibre, 7250);
});

test("mantiene el cierre del equipo como respaldo cuando no hay corte oficial completo", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    cortesOficiales: { completo: false, cajasFaltantes: 3 },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.fuenteCajas, "CIERRE_EQUIPO");
  assert.equal(resumen.efectivoCajas, 3000);
  assert.equal(resumen.dineroLibre, 9000);
});

test("prioriza aclarar el destino del retiro sin sumarlo como dinero disponible", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: {
      ...cierreCompleto,
      retiros: [{ branchId: "centro", cajaId: "CAJA_1", monto: 8000, estado: "PENDIENTE" }],
    },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.dineroLibre, 9000);
  assert.equal(resumen.controlRetiros.pendientes, 1);
  assert.match(resumen.prioridad.titulo, /destino del efectivo retirado/i);
});

test("no confunde una evidencia reportada con un retiro comprobado", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    deudasFinancieras: [],
    deudasConsultadas: true,
    obligacionesOperativasConfirmadas: true,
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: {
      ...cierreCompleto,
      retiros: [{ cierreId: "c1", branchId: "centro", cajaId: "CAJA_1", monto: 8000, estado: "IDENTIFICADO", destino: "DEPOSITO_BANCARIO", responsable: "Mónica", detalle: "BBVA" }],
    },
    comprobacionesRetiros: [{ cierre_id: "c1", caja_id: "CAJA_1", version: 1, estado: "REPORTADO" }],
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.comprobacionRetiros.reportados, 1);
  assert.equal(resumen.comprobacionRetiros.comprobados, 0);
  assert.match(resumen.prioridad.titulo, /comprueba el efectivo/i);
});


test("no presenta dinero libre si no se comprobaron deudas y gastos operativos", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, efectivoEntregado: 0 },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.dineroLibre, null);
  assert.equal(resumen.prioridad.titulo, "Completa el calendario de pagos de deuda");
});

test("descuenta deuda próxima del remanente y no lo llama dinero libre sin gastos operativos", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, efectivoEntregado: 0 },
    creditosProveedores: proveedoresConfirmados,
    deudasConsultadas: true,
    deudasFinancieras: [{ estado: "ACTIVA", pago_mensual: 1200, fecha_proximo_pago: "2026-10-20" }],
  });
  assert.equal(resumen.remanenteRegistrado, 7800);
  assert.equal(resumen.dineroLibre, null);
  assert.match(resumen.prioridad.detalle, /cobertura diaria no está confirmada/i);
});

test("bloquea una deuda marcada como diaria cuando solo tiene campo de pago mensual", () => {
  const resumen = resumirDisponibilidadFinanciera({
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, efectivoEntregado: 0 },
    creditosProveedores: proveedoresConfirmados,
    deudasConsultadas: true,
    deudasFinancieras: [{ estado: "ACTIVA", nombre: "Anticipo TPV · pago diario", pago_mensual: 3945.93, fecha_proximo_pago: "2026-10-20" }],
    obligacionesOperativasConfirmadas: true,
  });
  assert.equal(resumen.deudas.frecuenciasAmbiguas, 1);
  assert.equal(resumen.deudas.compromisos7Dias, 0);
  assert.equal(resumen.dineroLibre, null);
  assert.match(resumen.prioridad.detalle, /frecuencia distinta o dudosa/i);
});

test("resta obligaciones operativas de la caja y exige revisión vigente para liberar dinero", () => {
  const base = {
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, efectivoEntregado: 0 },
    creditosProveedores: proveedoresConfirmados,
    deudasConsultadas: true,
    deudasFinancieras: [],
    obligacionesOperativas: { completas: true, compromisos7Dias: 1000 },
  };
  const pendiente = resumirDisponibilidadFinanciera({ ...base, obligacionesOperativasConfirmadas: false });
  assert.equal(pendiente.remanenteRegistrado, 8000);
  assert.equal(pendiente.dineroLibre, null);
  assert.match(pendiente.prioridad.titulo, /revisaste todos los pagos/i);
  const confirmado = resumirDisponibilidadFinanciera({ ...base, obligacionesOperativasConfirmadas: true });
  assert.equal(confirmado.dineroLibre, 8000);
});

test("bloquea liquidez consolidada y dinero libre si hay un turno de caja abierto", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, efectivoEntregado: 0 },
    creditosProveedores: proveedoresConfirmados,
    deudasConsultadas: true,
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    obligacionesOperativasConfirmadas: true,
    sesionesCajaAbiertas: 1,
    sesionesCajaConsultadas: true,
  });
  assert.equal(resumen.liquidezLocalizada, null);
  assert.equal(resumen.dineroLibre, null);
  assert.equal(resumen.bloqueoConsolidacion, true);
  assert.ok(resumen.faltantes.some((item) => item.id === "sesiones-caja"));
});

test("bloquea consolidación con movimientos de Tesorería pendientes o si no se pudo consultar", () => {
  const base = {
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, efectivoEntregado: 0 },
    creditosProveedores: proveedoresConfirmados,
    deudasConsultadas: true,
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    obligacionesOperativasConfirmadas: true,
    sesionesCajaConsultadas: true,
  };
  const pendiente = resumirDisponibilidadFinanciera({ ...base, movimientosPendientes: 3, movimientosPendientesConsultados: true });
  assert.equal(pendiente.liquidezLocalizada, null);
  assert.equal(pendiente.dineroLibre, null);
  assert.ok(pendiente.faltantes.some((item) => item.id === "movimientos-pendientes"));

  const sinConsulta = resumirDisponibilidadFinanciera({ ...base, movimientosPendientesConsultados: false });
  assert.equal(sinConsulta.liquidezLocalizada, null);
  assert.equal(sinConsulta.dineroLibre, null);
  assert.equal(sinConsulta.prioridad.destino, "bancos");
});

test("una diferencia de caja impide sumar bancos y efectivo como liquidez consolidada", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, efectivoEntregado: 0, diferencias: 1 },
    creditosProveedores: proveedoresConfirmados,
    deudasConsultadas: true,
    obligacionesOperativas: { completas: true, compromisos7Dias: 0 },
    obligacionesOperativasConfirmadas: true,
  });
  assert.equal(resumen.liquidezLocalizada, null);
  assert.equal(resumen.dineroLibre, null);
  assert.equal(resumen.bloqueoConsolidacion, true);
});
