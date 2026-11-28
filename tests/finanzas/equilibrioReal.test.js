import test from "node:test";
import assert from "node:assert/strict";
import {
  consolidarEquilibrios,
  construirEquilibrioReal,
  diasDelMes,
  gastosFijosDelMes,
  pagosDeudaDelMes,
  vencimientosEnMes,
  ventasYMargen,
} from "../../src/core/finanzas/equilibrioReal.js";
import { calcularEquilibrioDiario } from "../../src/features/inteligencia/utils/equilibrioDiario.js";

// Datos sintéticos (el repositorio es público).
const obligaciones = [
  { concepto: "Renta tienda", categoria: "RENTA", importe: 40000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-11-05", estado: "PENDIENTE" },
  { concepto: "Nómina", categoria: "NOMINA", importe: 10000, frecuencia: "SEMANAL", fecha_vencimiento: "2026-11-27", estado: "PENDIENTE" },
  { concepto: "Internet", categoria: "SERVICIOS", importe: 800, frecuencia: "MENSUAL", fecha_vencimiento: "2026-11-10", estado: "PENDIENTE" },
  { concepto: "Luz", categoria: "SERVICIOS", importe: 4000, frecuencia: "BIMESTRAL", fecha_vencimiento: "2026-11-20", estado: "PENDIENTE" },
  { concepto: "Contador", categoria: "OTRO", importe: 3400, frecuencia: "MENSUAL", fecha_vencimiento: "2026-11-15", estado: "PENDIENTE" },
  { concepto: "Pago provisional SAT", categoria: "IMPUESTOS", importe: 6000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-11-17", estado: "PENDIENTE" },
  { concepto: "Pintura", categoria: "OTRO", importe: 2500, frecuencia: "UNICA", fecha_vencimiento: "2026-12-10", estado: "PENDIENTE" },
  { concepto: "Permiso", categoria: "OTRO", importe: 9000, frecuencia: "UNICA", fecha_vencimiento: "2027-01-15", estado: "PENDIENTE" },
  { concepto: "Renta vieja", categoria: "RENTA", importe: 30000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-01-01", estado: "CANCELADA" },
];

const sucursales = [{ id: "A", name: "Centro" }, { id: "B", name: "Nueva" }];
const periodo = { fechaInicio: "2026-11-01", fechaFin: "2026-11-10" };
const ventasPorSucursal = [
  { branch_id: "A", periodo, ventas: [
    { importe: 6000, utilidad: 2400, importeDisponible: true, utilidadDisponible: true },
    { importe: 4000, utilidad: 1600, importeDisponible: true, utilidadDisponible: true },
  ] },
  { branch_id: "B", periodo, ventas: [{ importe: 2500, utilidad: 1000, importeDisponible: true, utilidadDisponible: true }] },
];
const deudas = [{ nombre: "Tarjeta", saldo_actual: 60000, tasa_anual: 48, pago_mensual: 8000, estado: "ACTIVA" }];

/* ---------- Calendario y gastos ---------- */

test("vencimientos del calendario por frecuencia", () => {
  assert.equal(vencimientosEnMes({ frecuencia: "SEMANAL", fecha_vencimiento: "2026-11-27" }, "2026-12"), 4); // 4, 11, 18, 25
  assert.equal(vencimientosEnMes({ frecuencia: "SEMANAL", fecha_vencimiento: "2026-11-27" }, "2027-01"), 5); // 1, 8, 15, 22, 29
  assert.equal(vencimientosEnMes({ frecuencia: "QUINCENAL", fecha_vencimiento: "2026-12-04" }, "2026-12"), 2); // dos quincenas por mes
  assert.equal(vencimientosEnMes({ frecuencia: "BIMESTRAL", fecha_vencimiento: "2026-11-20" }, "2026-12"), 0);
  assert.equal(vencimientosEnMes({ frecuencia: "BIMESTRAL", fecha_vencimiento: "2026-11-20" }, "2027-01"), 1);
  assert.equal(vencimientosEnMes({ frecuencia: "UNICA", fecha_vencimiento: "2026-12-10" }, "2026-12"), 1);
  assert.equal(vencimientosEnMes({ frecuencia: "MENSUAL", fecha_vencimiento: "sin fecha" }, "2026-12"), null);
});

test("presupuesto mensual (promedio) distinto de devengado del mes (calendario); impuestos aparte", () => {
  const gastos = gastosFijosDelMes(obligaciones, "2026-12");
  const presupuesto = 40000 + 10000 * 52 / 12 + 800 + 4000 / 2 + 3400 + 2500;
  assert.equal(gastos.total, Math.round(presupuesto * 100) / 100);
  // Diciembre: 4 nóminas, luz no vence (bimestral nov/ene).
  assert.equal(gastos.devengadoOperativo, 40000 + 4 * 10000 + 800 + 3400 + 2500);
  assert.equal(gastos.impuestosDevengados, 6000);
  assert.equal(gastos.porCategoria.IMPUESTOS, 6000);
  assert.equal(gastos.completo, true);
});

test("sin renta, nómina o servicios capturados no se da un total", () => {
  const gastos = gastosFijosDelMes([{ concepto: "Contador", categoria: "OTRO", importe: 3400, frecuencia: "MENSUAL", fecha_vencimiento: "2026-11-15" }], "2026-12");
  assert.equal(gastos.total, null);
  assert.equal(gastos.totalCapturado, 3400);
  assert.equal(gastos.faltantes.length, 3);
});

test("importe, frecuencia o fecha inválidos dejan el gasto incompleto", () => {
  const gastos = gastosFijosDelMes([
    ...obligaciones,
    { concepto: "Raro", categoria: "OTRO", importe: 100, frecuencia: "DIARIA", fecha_vencimiento: "2026-12-01" },
    { concepto: "Sin fecha", categoria: "OTRO", importe: 100, frecuencia: "MENSUAL" },
  ], "2026-12");
  assert.equal(gastos.total, null);
  assert.ok(gastos.faltantes.includes("frecuencia de Raro"));
  assert.ok(gastos.faltantes.includes("fecha de vencimiento de Sin fecha"));
});

/* ---------- Deuda: capital frente a intereses ---------- */

test("deuda: separa intereses (gasto) de capital (no gasto)", () => {
  const deuda = pagosDeudaDelMes(deudas);
  assert.equal(deuda.total, 8000);
  assert.equal(deuda.intereses, 2400); // 60,000 × 48% ÷ 12
  assert.equal(deuda.capital, 5600);
  const sinTasa = pagosDeudaDelMes([{ nombre: "Familiar", pago_mensual: 5000, saldo_actual: 50000, estado: "ACTIVA" }]);
  assert.equal(sinTasa.total, 5000);
  assert.equal(sinTasa.intereses, null);
  assert.equal(sinTasa.capital, null);
  assert.equal(pagosDeudaDelMes([]).total, null);
  assert.equal(pagosDeudaDelMes([], { sinDeudasConfirmado: true }).total, 0);
  assert.deepEqual(pagosDeudaDelMes([{ nombre: "X", pago_mensual: null, estado: "ACTIVA" }]).faltantes, ["pago mensual de X"]);
});

/* ---------- Ventas y días de cierre ---------- */

test("venta diaria sobre días abiertos confirmados de cada sucursal", () => {
  // Nueva abrió solo 5 de los 10 días del periodo.
  const ventas = ventasYMargen(ventasPorSucursal, sucursales, { diasAbiertosPeriodo: { A: 10, B: 5 } });
  assert.equal(ventas.detalle[0].ventaDiaria, 1000);
  assert.equal(ventas.detalle[1].ventaDiaria, 500);
  assert.equal(ventas.margenBruto, 40);
  assert.equal(ventas.comparables, true);
  assert.equal(ventas.avisos.length, 0);

  const sinConfirmar = ventasYMargen(ventasPorSucursal, sucursales);
  assert.equal(sinConfirmar.detalle[1].ventaDiaria, 250);
  assert.equal(sinConfirmar.detalle[1].diasConfirmados, false);
  assert.ok(sinConfirmar.avisos.some((texto) => texto.includes("Nueva")));

  const invalido = ventasYMargen(ventasPorSucursal, sucursales, { diasAbiertosPeriodo: { B: 15 } });
  assert.ok(invalido.faltantes.includes("días abiertos válidos de Nueva en el periodo (1 a 10)"));
});

test("periodos no comparables, banderas desconocidas y utilidad incompleta", () => {
  const distinto = ventasYMargen(
    [ventasPorSucursal[0], { ...ventasPorSucursal[1], periodo: { fechaInicio: "2026-11-01", fechaFin: "2026-11-05" } }],
    sucursales
  );
  assert.equal(distinto.comparables, false);

  const viejas = ventasYMargen([{ branch_id: "A", periodo, ventas: [{ importe: 100, utilidad: 40 }] }], [sucursales[0]]);
  assert.equal(viejas.banderasDesconocidas, 1);

  const parcial = ventasYMargen([{ branch_id: "A", periodo, ventas: [
    { importe: 6000, utilidad: 2400 },
    { importe: 4000, utilidad: 0 },
  ] }], [sucursales[0]]);
  assert.equal(parcial.margenBruto, null);
  assert.ok(parcial.faltantes.includes("utilidad en 40% de la venta"));

  assert.ok(ventasYMargen([ventasPorSucursal[0]], sucursales).faltantes.includes("reporte Ventas por artículo de Nueva"));
});

/* ---------- Tres indicadores ---------- */

const base = {
  mes: "2026-12",
  hoy: "2027-01-05T18:00:00Z",
  obligaciones,
  deudas,
  ventasPorSucursal,
  sucursales,
  diasAbiertos: 26,
  diasAbiertosMes: { A: 26, B: 20 },
  diasAbiertosPeriodo: { A: 10, B: 5 },
  variablePorcentaje: 3,
};

test("tres indicadores independientes: operativo, efectivo y utilidad neta", () => {
  const real = construirEquilibrioReal(base);
  assert.equal(real.calculable, true);
  assert.equal(real.tipo, "ESTIMACION");
  // Venta prevista: 1,000 × 26 + 500 × 20.
  assert.equal(real.datos.ventaPrevista, "36000");
  const contribucion = 0.37;
  const gastos = Number(real.datos.gastosFijos);
  assert.equal(real.indicadores.operativo.ventaMensual, Math.round(gastos / contribucion * 100) / 100);
  // Efectivo: + servicio de deuda (8,000) + impuestos del mes (6,000).
  assert.equal(real.indicadores.efectivo.compromisos, 14000);
  assert.equal(real.indicadores.efectivo.ventaMensual, Math.round((gastos + 14000) / contribucion * 100) / 100);
  // Utilidad neta: solo intereses, no capital.
  assert.equal(real.indicadores.utilidadNeta.intereses, 2400);
  assert.equal(real.indicadores.utilidadNeta.capitalNoEsGasto, 5600);
  assert.equal(real.indicadores.utilidadNeta.utilidadNetaEstimada, Math.round((36000 * contribucion - gastos - 2400) * 100) / 100);
  // El indicador de efectivo es el simulador existente sin cambios.
  assert.deepEqual(real.resultado, calcularEquilibrioDiario(real.datos));
});

test("sin tasa no hay utilidad neta y se pide el dato", () => {
  const real = construirEquilibrioReal({ ...base, deudas: [{ nombre: "Familiar", pago_mensual: 5000, estado: "ACTIVA" }] });
  assert.equal(real.indicadores.utilidadNeta, null);
  assert.ok(real.indicadores.efectivo);
  assert.ok(real.faltantes.includes("intereses de deuda separados de capital (tasa y saldo)"));
  assert.equal(real.calculable, false);
});

/* ---------- Confianza ---------- */

const conciliacionAlta = { confianza: "alta", motivosConfianza: [], gastoOperativoReal: 1, diferencias: [], sinClasificar: [] };

test("confianza: nunca alta con mes abierto, días no confirmados, periodos no comparables o descartes", () => {
  assert.equal(construirEquilibrioReal({ ...base, conciliacion: conciliacionAlta }).confianza, "alta");
  assert.equal(construirEquilibrioReal(base).confianza, "baja"); // sin conciliación
  assert.equal(construirEquilibrioReal({ ...base, conciliacion: conciliacionAlta, hoy: "2026-12-15T18:00:00Z" }).confianza, "media");
  assert.equal(construirEquilibrioReal({ ...base, conciliacion: conciliacionAlta, diasAbiertosMes: { A: 26 } }).confianza, "media");
  assert.equal(construirEquilibrioReal({ ...base, conciliacion: conciliacionAlta, diasAbiertosPeriodo: {} }).confianza, "media");
  assert.equal(construirEquilibrioReal({ ...base, conciliacion: conciliacionAlta, descartados: 2 }).confianza, "media");
  assert.equal(construirEquilibrioReal({ ...base, conciliacion: conciliacionAlta, diasAbiertos: null }).confianza, "baja");
});

test("lo que falta queda vacío y listado, nunca en cero", () => {
  const real = construirEquilibrioReal({ mes: "2026-12", obligaciones, ventasPorSucursal, sucursales });
  assert.equal(real.calculable, false);
  assert.equal(real.datos.diasAbiertos, "");
  assert.equal(real.datos.variablePorcentaje, "");
  assert.equal(real.datos.deuda, "");
  assert.equal(real.datos.ventaPrevista, "");
  assert.ok(real.faltantes.includes("días que abrirá el negocio en el mes"));
  assert.ok(real.faltantes.includes("confirmar que no hay deudas abiertas"));
});

test("valida mes y días abiertos", () => {
  assert.equal(diasDelMes("2026-02"), 28);
  assert.equal(diasDelMes("2026-13"), null);
  assert.ok(construirEquilibrioReal({ ...base, mes: "2026-02", diasAbiertos: 30 }).faltantes.includes("días que abrirá el negocio en el mes"));
  assert.equal(construirEquilibrioReal({ mes: "dic", obligaciones }).faltantes[0], "mes del escenario");
});

/* ---------- Consolidado para dirección ---------- */

test("consolidado: suma solo negocios calculables y toma la menor confianza", () => {
  const tienda = construirEquilibrioReal({ ...base, conciliacion: conciliacionAlta });
  const flotilla = construirEquilibrioReal({ ...base, conciliacion: { ...conciliacionAlta, confianza: "media" } });
  const consolidado = consolidarEquilibrios([tienda, flotilla]);
  assert.equal(consolidado.negociosIncluidos, 2);
  assert.equal(consolidado.completo, true);
  assert.equal(consolidado.confianza, "media");
  assert.equal(consolidado.ventaMensualEfectivo, Math.round(tienda.indicadores.efectivo.ventaMensual * 2 * 100) / 100);

  const incompleto = consolidarEquilibrios([tienda, construirEquilibrioReal({ mes: "2026-12" })]);
  assert.equal(incompleto.negociosExcluidos, 1);
  assert.equal(incompleto.completo, false);
  assert.equal(incompleto.confianza, "baja");
});
