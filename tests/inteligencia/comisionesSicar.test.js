import test from "node:test";
import assert from "node:assert/strict";
import { resumirComisionesSicar, validarConteoImportacionSicar } from "../../src/features/inteligencia/shared/resumenComisionesSicar.js";

const empleados = [
  { id: "1", nombre: "Karla", usuario_sicar: "KARLA" },
  { id: "2", nombre: "Kary", usuario_sicar: "kary jimenez" },
];

test("calcula 1% por empleada solo con usuario SICAR asignado y folio único", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05",
    hasta: "2026-10-11",
    empleados,
    filas: [
      { datos_originales: { fecha: "2026-10-05", folio: "A-1", usuario: "Karla", ventaTotal: 10000 } },
      { datos_originales: { fecha: "2026-10-05", folio: "A-1", usuario: "Karla", ventaTotal: 10000 } },
      { datos_originales: { fecha: "2026-10-06", folio: "A-2", usuario: "Kary Jimenez", ventaTotal: 2500 } },
      { datos_originales: { fecha: "2026-10-12", folio: "A-3", usuario: "Karla", ventaTotal: 900 } },
      { datos_originales: { fecha: "2026-10-06", folio: "A-4", usuario: "Otro", ventaTotal: 500 } },
    ],
  });
  assert.equal(resumen.tickets, 3);
  assert.equal(resumen.ventasPeriodo, 13000);
  assert.equal(resumen.ventasAsignadas, 12500);
  assert.equal(resumen.ventasSinAsignar, 500);
  assert.equal(resumen.comisionTotal, 125);
  assert.deepEqual(resumen.comisiones.map((item) => item.empleado), ["Karla", "Kary"]);
});

test("no calcula comisión cuando la asignación SICAR es ambigua", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05",
    hasta: "2026-10-11",
    empleados: [
      { id: "1", nombre: "Karla Centro", usuario_sicar: "Vendedora" },
      { id: "2", nombre: "Karla GA", usuario_sicar: " vendedora " },
    ],
    filas: [{ fecha: "05/10/2026", folio: "B-1", usuario: "Vendedora", totalVenta: "$2,000.00" }],
  });
  assert.equal(resumen.comisiones.length, 0);
  assert.equal(resumen.sinAsignar[0].motivo, "ASIGNACION_AMBIGUA");
  assert.equal(resumen.comisionTotal, 0);
});

test("reporta filas sin folio, usuario o fecha como no verificables", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados, filas: [
      { fecha: "2026-10-06", folio: "", usuario: "Karla", ventaTotal: 1000 },
    ],
  });
  assert.equal(resumen.filasSinIdentidad, 1);
  assert.equal(resumen.tickets, 0);
});

test("CRM atribuye al responsable por folio SICAR y deduplica tickets", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{ id: "o1", etapa: "GANADO", folio_venta_sicar: "A-9", empleado_id: "2" }],
    filas: [
      { datos_originales: { fecha: "2026-10-06", folio: "A-9", usuario: "Karla", ventaTotal: 4000 } },
      { datos_originales: { fecha: "2026-10-06", folio: "A-9", usuario: "Caja", ventaTotal: 4000 } },
    ],
  });
  assert.equal(resumen.tickets, 1);
  assert.equal(resumen.ventasAsignadas, 4000);
  assert.equal(resumen.comisiones.length, 1);
  assert.equal(resumen.comisiones[0].empleado, "Kary");
  assert.equal(resumen.comisiones[0].ticketsCRM, 1);
  assert.equal(resumen.comisionTotal, 40);
});
test("separa importes negativos como ajustes pendientes sin deducirlos automáticamente de la comisión", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    filas: [
      { fecha: "2026-10-06", folio: "R-1", usuario: "Karla", ventaTotal: 1000 },
      { fecha: "2026-10-07", folio: "R-2", usuario: "Karla", ventaTotal: -250 },
      { fecha: "2026-10-07", folio: "R-2", usuario: "Karla", ventaTotal: -250 },
    ],
  });
  assert.equal(resumen.tickets, 1);
  assert.equal(resumen.comisionTotal, 10);
  assert.equal(resumen.ajustesNegativosPendientes.tickets, 1);
  assert.equal(resumen.ajustesNegativosPendientes.importe, -250);
});

test("no asigna al cajero si la oportunidad CRM ganada aún no tiene responsable", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{ id: "o2", etapa: "GANADO", folio_venta_sicar: "A-10", empleado_id: null }],
    filas: [{ fecha: "2026-10-06", folio: "A-10", usuario: "KARLA", ventaTotal: 3000 }],
  });
  assert.equal(resumen.comisionTotal, 0);
  assert.equal(resumen.ventasSinAsignar, 3000);
  assert.equal(resumen.conciliacion[0].estado, "CRM_SIN_RESPONSABLE");
});
test("lista folios CRM sin ticket en la importación seleccionada", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{ id: "o3", etapa: "GANADO", folio_venta_sicar: "A-11", empleado_id: "2" }],
    filas: [],
  });
  assert.equal(resumen.tickets, 0);
  assert.equal(resumen.conciliacion.length, 1);
  assert.equal(resumen.conciliacion[0].estado, "CRM_SIN_TICKET_EN_REPORTE");
  assert.equal(resumen.conciliacion[0].importe, null);
  assert.equal(resumen.ticketsPorRevisar, 0);
});
test("permite atribuir por CRM un folio real sin usuario SICAR y lo deja rastreable", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{ id: "o4", etapa: "GANADO", folio_venta_sicar: "A-12", empleado_id: "2" }],
    filas: [{ fecha: "2026-10-06", folio: "A-12", usuario: "", ventaTotal: 1800 }],
  });
  assert.equal(resumen.tickets, 1);
  assert.equal(resumen.comisionTotal, 18);
  assert.equal(resumen.conciliacion[0].estado, "CRM_ATRIBUIDO");
  assert.equal(resumen.conciliacion[0].usuarioSicar, "");
});


test("deja en revisión los folios atendidos por varias empleadas y muestra sus nombres", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{
      id: "o5", etapa: "GANADO", folio_venta_sicar: "A-13", empleado_id: "1",
      participantes_empleado_ids: ["1", "2"],
      participantes_empleados: [{ id: "1", nombre: "Karla" }, { id: "2", nombre: "Kary" }],
      participacion_verificada: true,
    }],
    filas: [{ fecha: "2026-10-06", folio: "A-13", usuario: "Karla", ventaTotal: 5000 }],
  });
  assert.equal(resumen.comisionTotal, 0);
  assert.equal(resumen.ventasSinAsignar, 5000);
  assert.equal(resumen.ticketsPorRevisar, 1);
  assert.equal(resumen.conciliacion[0].estado, "CRM_MULTIPLES_EMPLEADAS");
  assert.deepEqual(resumen.conciliacion[0].participantes, ["Karla", "Kary"]);
});

test("no paga automáticamente cuando no se pudo verificar la participación del CRM", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{
      id: "o6", etapa: "GANADO", folio_venta_sicar: "A-14", empleado_id: "2",
      participantes_empleado_ids: ["2"], participacion_verificada: false,
    }],
    filas: [{ fecha: "2026-10-06", folio: "A-14", usuario: "Karla", ventaTotal: 3200 }],
  });
  assert.equal(resumen.comisionTotal, 0);
  assert.equal(resumen.ventasSinAsignar, 3200);
  assert.equal(resumen.conciliacion[0].estado, "CRM_PARTICIPACION_NO_VERIFICADA");
});

test("deduplica responsable y participante CRM cuando se trata de la misma empleada", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{
      id: "o7", etapa: "GANADO", folio_venta_sicar: "A-15", empleado_id: "2",
      participantes_empleado_ids: ["2"], participacion_verificada: true,
    }],
    filas: [{ fecha: "2026-10-06", folio: "A-15", usuario: "Karla", ventaTotal: 2100 }],
  });
  assert.equal(resumen.comisionTotal, 21);
  assert.equal(resumen.comisiones[0].empleado, "Kary");
});

test("muestra participantes y revisión cuando falta el ticket en el reporte de SICAR", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{
      id: "o8", etapa: "GANADO", folio_venta_sicar: "A-16", empleado_id: "1",
      participantes_empleado_ids: ["1", "2"],
      participantes_empleados: [{ id: "1", nombre: "Karla" }, { id: "2", nombre: "Kary" }],
      participacion_verificada: true,
    }],
    filas: [],
  });
  assert.equal(resumen.conciliacion[0].estado, "CRM_MULTIPLES_EMPLEADAS");
  assert.deepEqual(resumen.conciliacion[0].participantes, ["Karla", "Kary"]);
});


test("bloquea comisiones cuando el detalle SICAR no coincide con las filas importadas", () => {
  const filas = [{ numero_fila: 1 }, { numero_fila: 2 }];
  assert.equal(validarConteoImportacionSicar({ filas, totalFilasEsperadas: 2 }), filas);
  assert.throws(
    () => validarConteoImportacionSicar({ filas, totalFilasEsperadas: 3 }),
    /No se calcularán comisiones con este reporte/,
  );
  assert.throws(
    () => validarConteoImportacionSicar({ filas }),
    /No se pudo verificar el total esperado/,
  );
});

test("no asigna la cuenta SICAR compartida de una sucursal a una sola empleada", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11",
    empleados: [...empleados, { id: "3", nombre: "Centro", usuario_sicar: "sucursalcentro" }],
    filas: [{ fecha: "2026-10-06", folio: "S-1", usuario: "sucursalcentro", ventaTotal: 8200 }],
  });
  assert.equal(resumen.comisiones.length, 0);
  assert.equal(resumen.ventasSinAsignar, 8200);
  assert.equal(resumen.comisionTotal, 0);
  assert.equal(resumen.conciliacion[0].estado, "USUARIO_SICAR_COMPARTIDO");
  assert.equal(resumen.sinAsignar[0].motivo, "USUARIO_SICAR_COMPARTIDO");
});

test("CRM puede atribuir por folio aunque SICAR use la cuenta compartida de sucursal", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{ id: "o-shared", etapa: "GANADO", folio_venta_sicar: "S-2", empleado_id: "2" }],
    filas: [{ fecha: "2026-10-06", folio: "S-2", usuario: "general.anaya", ventaTotal: 3200 }],
  });
  assert.equal(resumen.ventasAsignadas, 3200);
  assert.equal(resumen.comisionTotal, 32);
  assert.equal(resumen.comisiones[0].empleado, "Kary");
  assert.equal(resumen.conciliacion[0].estado, "CRM_ATRIBUIDO");
});
