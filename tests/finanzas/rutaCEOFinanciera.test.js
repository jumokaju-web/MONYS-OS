import test from "node:test";
import assert from "node:assert/strict";
import { construirIniciativaValorCEO, construirRutaCEOFinanciera, construirTareaRevisionCEO } from "../../src/features/inteligencia/utils/rutaCEOFinanciera.js";

const metricasValidas = {
  ventasTotales: 10000,
  costoTotal: 7000,
  utilidadTotal: 3000,
  fechaInicial: "2026-10-01",
  fechaFinal: "2026-10-14",
  diasAnalizados: 14,
};

test("prioriza validar SICAR y conserva cifras ausentes como pendientes", () => {
  const ruta = construirRutaCEOFinanciera({
    metricas: { ...metricasValidas, costoTotal: null },
    baseVigente: true,
  });

  assert.equal(ruta.prioridad.estado, "PENDIENTE");
  assert.equal(ruta.metricasClave[1].valor, null);
  assert.equal(ruta.metricasClave[1].estado, "PENDIENTE");
  assert.equal(ruta.metricasClave[2].valor, 3000);
  assert.equal(ruta.metricasClave[2].estado, "REAL");
  assert.equal(ruta.metricasClave[3].estado, "ESTIMACIÓN");
  assert.match(ruta.prioridad.porQue, /costo de venta SICAR/);
});

test("bloquea el análisis si los días reportados no coinciden con el rango de fechas", () => {
  const ruta = construirRutaCEOFinanciera({
    metricas: { ...metricasValidas, diasAnalizados: 7 },
    baseVigente: true,
  });

  assert.equal(ruta.periodo, null);
  assert.equal(ruta.prioridad.estado, "PENDIENTE");
  assert.match(ruta.prioridad.porQue, /indica 7 días y las fechas abarcan 14/);
  assert.match(ruta.prioridad.accion, /Completa o corrige únicamente/);
});

test("no permite comprometer efectivo si falta conciliar movimientos", () => {
  const ruta = construirRutaCEOFinanciera({
    metricas: metricasValidas,
    baseVigente: true,
    movimientos: [{ monto: 1000 }],
    movimientosPendientes: null,
  });

  assert.equal(ruta.prioridad.titulo, "Protege liquidez antes de comprometer efectivo");
  assert.match(ruta.prioridad.porQue, /falta confirmar/);
});

test("marca ventas y utilidad como reales y margen como cálculo estimado", () => {
  const ruta = construirRutaCEOFinanciera({
    metricas: metricasValidas,
    baseVigente: true,
    movimientos: [{ monto: 1000 }],
    movimientosPendientes: 0,
    gastosSinClasificar: 0,
  });

  assert.equal(ruta.prioridad.estado, "REAL");
  assert.equal(ruta.metricasClave[0].estado, "REAL");
  assert.equal(ruta.metricasClave[1].estado, "REAL");
  assert.equal(ruta.metricasClave[3].estado, "ESTIMACIÓN");
  assert.equal(ruta.metricasClave[3].valor, 30);
});

test("no trata una base antigua como lista para decisiones nuevas", () => {
  const ruta = construirRutaCEOFinanciera({ metricas: metricasValidas, baseVigente: false });

  assert.equal(ruta.prioridad.estado, "PENDIENTE");
  assert.match(ruta.prioridad.porQue, /desactualizado/);
});

test("acepta cortes de SICAR entregados como fechas Date sin desplazar el periodo", () => {
  const ruta = construirRutaCEOFinanciera({
    metricas: {
      ...metricasValidas,
      fechaInicial: new Date("2026-10-01T12:00:00.000Z"),
      fechaFinal: new Date("2026-10-14T12:00:00.000Z"),
    },
    baseVigente: true,
  });

  assert.deepEqual(ruta.periodo, { inicio: "2026-10-01", fin: "2026-10-14", dias: 14 });
  assert.equal(ruta.metricasClave[0].estado, "REAL");
});

test("solo marca el comparativo de sucursales como comparable con el mismo corte", () => {
  const base = [
    { id: "centro", nombre: "Centro", ventasTotales: 2000, utilidadTotal: 800, periodo: { fechaInicial: "2026-10-01", fechaFinal: "2026-10-07" } },
    { id: "anaya", nombre: "General Anaya", ventasTotales: 1000, utilidadTotal: 350, periodo: { fechaInicial: "2026-10-01", fechaFinal: "2026-10-07" } },
  ];
  const iguales = construirRutaCEOFinanciera({ sucursales: base });
  const distintos = construirRutaCEOFinanciera({ sucursales: [base[0], { ...base[1], periodo: { fechaInicial: "2026-10-02", fechaFinal: "2026-10-08" } }] });

  assert.equal(iguales.cortesSucursalComparables, true);
  assert.equal(distintos.cortesSucursalComparables, false);
});

test("conserva valores por sucursal ausentes como pendientes", () => {
  const ruta = construirRutaCEOFinanciera({
    sucursales: [{ id: "centro", nombre: "Centro", ventasTotales: null, utilidadTotal: 0, periodo: { fechaInicio: "2026-10-01", fechaFin: "2026-10-07" } }],
  });

  assert.equal(ruta.sucursalesResultado[0].ventas, null);
  assert.equal(ruta.sucursalesResultado[0].utilidad, 0);
  assert.equal(ruta.sucursalesResultado[0].margen, null);
});

test("el importe sin clasificar conserva la diferencia entre cero y dato ausente", () => {
  const pendiente = construirRutaCEOFinanciera({
    metricas: metricasValidas,
    baseVigente: true,
    movimientos: [{ monto: 1000 }],
    movimientosPendientes: 0,
    gastosSinClasificar: null,
  });
  const confirmado = construirRutaCEOFinanciera({
    metricas: metricasValidas,
    baseVigente: true,
    movimientos: [{ monto: 1000 }],
    movimientosPendientes: 0,
    gastosSinClasificar: 0,
  });

  assert.equal(pendiente.prioridad.estado, "PENDIENTE");
  assert.equal(confirmado.prioridad.estado, "REAL");
});

test("la revisión requiere sucursal, responsable vinculado, fecha y evidencia", () => {
  const datos = {
    prioridad: { titulo: "Proteger liquidez", porQue: "Falta conciliar", accion: "Conciliar caja", pregunta: "¿Qué efectivo queda?" },
    organizationId: "org-1",
    businessId: "business-1",
    branchId: "branch-1",
    responsable: { nombre: "Ana", usuarioId: "user-1" },
    fechaRevision: "2026-10-20",
    criterioExito: "Conciliación con diferencias explicadas y evidencia.",
  };

  assert.throws(() => construirTareaRevisionCEO({ ...datos, branchId: null }), /sucursal/);
  assert.throws(() => construirTareaRevisionCEO({ ...datos, responsable: { nombre: "Ana" } }), /acceso vinculado/);
  assert.throws(() => construirTareaRevisionCEO({ ...datos, fechaRevision: "2026-02-30" }), /revisión válida/);
  assert.throws(() => construirTareaRevisionCEO({ ...datos, criterioExito: " " }), /evidencia/);
});

test("la revisión conserva alcance, responsable, fecha y evidencia sin aprobar gasto", () => {
  const tarea = construirTareaRevisionCEO({
    prioridad: { titulo: "Proteger liquidez", porQue: "Falta conciliar", accion: "Conciliar caja", pregunta: "¿Qué efectivo queda?" },
    organizationId: "org-1",
    businessId: "business-1",
    branchId: "branch-1",
    responsable: { nombre: "Ana", usuarioId: "user-1" },
    fechaRevision: "2026-10-20",
    criterioExito: "Conciliación con diferencias explicadas y evidencia.",
  });

  assert.equal(tarea.organizationId, "org-1");
  assert.equal(tarea.businessId, "business-1");
  assert.equal(tarea.branchId, "branch-1");
  assert.equal(tarea.responsable, "Ana");
  assert.equal(tarea.responsableUsuarioId, "user-1");
  assert.equal(tarea.fecha, "2026-10-20");
  assert.equal(tarea.requiereEvidencia, true);
  assert.match(tarea.instrucciones, /no autoriza pagos, compras/);
});

test("prellena una iniciativa económica solo con utilidad SICAR del mismo negocio y sucursal", () => {
  const iniciativa = construirIniciativaValorCEO({
    prioridad: { estado: "REAL", titulo: "Revisar rentabilidad", accion: "Probar exhibición" },
    sucursal: {
      id: "branch-1",
      nombre: "Centro",
      utilidad: 0,
      periodo: { inicio: "2026-10-01", fin: "2026-10-07" },
      diasPeriodo: 7,
    },
    branchIdActual: "branch-1",
  });

  assert.equal(iniciativa.base, "0");
  assert.equal(iniciativa.dias, "7");
  assert.equal(iniciativa.indicador, "utilidad_bruta");
  assert.match(iniciativa.fuenteBase, /Centro · 2026-10-01 a 2026-10-07/);
  assert.equal(iniciativa.fecha, "");
});

test("no abre medición con cifra pendiente, prioridad no validada o sucursal distinta", () => {
  const parametros = {
    prioridad: { estado: "REAL", titulo: "Revisar rentabilidad", accion: "Probar exhibición" },
    sucursal: { id: "branch-1", nombre: "Centro", utilidad: null, periodo: { inicio: "2026-10-01", fin: "2026-10-07" }, diasPeriodo: 7 },
    branchIdActual: "branch-1",
  };

  assert.equal(construirIniciativaValorCEO(parametros), null);
  assert.equal(construirIniciativaValorCEO({ ...parametros, sucursal: { ...parametros.sucursal, utilidad: 120 }, prioridad: { ...parametros.prioridad, estado: "PENDIENTE" } }), null);
  assert.equal(construirIniciativaValorCEO({ ...parametros, sucursal: { ...parametros.sucursal, utilidad: 120 }, branchIdActual: "branch-2" }), null);
});
