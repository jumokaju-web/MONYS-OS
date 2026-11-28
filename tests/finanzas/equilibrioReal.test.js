import test from "node:test";
import assert from "node:assert/strict";
import {
  construirEquilibrioReal,
  diasDelMes,
  gastosFijosDelMes,
  pagosDeudaDelMes,
  ventasYMargen,
} from "../../src/core/finanzas/equilibrioReal.js";
import { calcularEquilibrioDiario } from "../../src/features/inteligencia/utils/equilibrioDiario.js";

// Datos sintéticos (el repositorio es público).
const obligaciones = [
  { concepto: "Renta tienda", categoria: "RENTA", importe: 40000, frecuencia: "MENSUAL", estado: "PENDIENTE" },
  { concepto: "Nómina", categoria: "NOMINA", importe: 10000, frecuencia: "SEMANAL", estado: "PENDIENTE" },
  { concepto: "Internet", categoria: "SERVICIOS", importe: 800, frecuencia: "MENSUAL", estado: "PENDIENTE" },
  { concepto: "Luz", categoria: "SERVICIOS", importe: 4000, frecuencia: "BIMESTRAL", estado: "PENDIENTE" },
  { concepto: "Contador", categoria: "OTRO", importe: 3400, frecuencia: "MENSUAL", estado: "PENDIENTE" },
  { concepto: "Pintura", categoria: "OTRO", importe: 2500, frecuencia: "UNICA", fecha_vencimiento: "2026-12-10", estado: "PENDIENTE" },
  { concepto: "Permiso", categoria: "OTRO", importe: 9000, frecuencia: "UNICA", fecha_vencimiento: "2027-01-15", estado: "PENDIENTE" },
  { concepto: "Renta vieja", categoria: "RENTA", importe: 30000, frecuencia: "MENSUAL", estado: "CANCELADA" },
];

const sucursales = [{ id: "A", name: "Centro" }, { id: "B", name: "Nueva" }];
const ventasPorSucursal = [
  { branch_id: "A", periodo: { fechaInicio: "2026-11-01", fechaFin: "2026-11-10" }, ventas: [
    { codigo: "1", importe: 6000, utilidad: 2400 },
    { codigo: "2", importe: 4000, utilidad: 1600 },
  ] },
  { branch_id: "B", periodo: { fechaInicio: "2026-11-01", fechaFin: "2026-11-05" }, ventas: [
    { codigo: "1", importe: 2500, utilidad: 1000 },
  ] },
];

test("gastos fijos: recurrentes a su equivalente mensual y únicas solo del mes", () => {
  const gastos = gastosFijosDelMes(obligaciones, "2026-12");
  const esperado = 40000 + 10000 * 52 / 12 + 800 + 4000 / 2 + 3400 + 2500;
  assert.equal(gastos.total, Math.round(esperado * 100) / 100);
  assert.equal(gastos.porCategoria.SERVICIOS, 2800);
  assert.equal(gastos.completo, true);
  // El permiso vence en enero: no entra a diciembre. La renta cancelada no cuenta.
  assert.equal(gastos.consideradas, 6);
});

test("sin renta, nómina o servicios capturados no se da un total", () => {
  const gastos = gastosFijosDelMes([{ concepto: "Contador", categoria: "OTRO", importe: 3400, frecuencia: "MENSUAL" }], "2026-12");
  assert.equal(gastos.total, null);
  assert.equal(gastos.totalCapturado, 3400);
  assert.deepEqual(gastos.faltantes, [
    "gasto de renta (no capturado)",
    "gasto de nomina (no capturado)",
    "gasto de servicios (no capturado)",
  ]);
});

test("importe o frecuencia inválidos dejan el gasto incompleto", () => {
  const gastos = gastosFijosDelMes([...obligaciones, { concepto: "Raro", categoria: "OTRO", importe: 100, frecuencia: "DIARIA" }], "2026-12");
  assert.equal(gastos.total, null);
  assert.ok(gastos.faltantes.includes("frecuencia de Raro"));
});

test("deuda: suma pagos mensuales y no inventa cero", () => {
  assert.equal(pagosDeudaDelMes([
    { nombre: "Tarjeta", pago_mensual: 3000, estado: "ACTIVA" },
    { nombre: "Banco", pago_mensual: 5000, estado: "REESTRUCTURADA" },
    { nombre: "Vieja", pago_mensual: 9999, estado: "LIQUIDADA" },
  ]).total, 8000);
  const sinPago = pagosDeudaDelMes([{ nombre: "Familiar", pago_mensual: null, estado: "ACTIVA" }]);
  assert.equal(sinPago.total, null);
  assert.deepEqual(sinPago.faltantes, ["pago mensual de Familiar"]);
  assert.equal(pagosDeudaDelMes([]).total, null);
  assert.equal(pagosDeudaDelMes([], { sinDeudasConfirmado: true }).total, 0);
});

test("ventas: venta diaria por sucursal con su propio periodo y margen con cobertura completa", () => {
  const ventas = ventasYMargen(ventasPorSucursal, sucursales);
  // Centro 10,000 en 10 días + Nueva 2,500 en 5 días = 1,000 + 500 diarios.
  assert.equal(ventas.ventaDiaria, 1500);
  assert.equal(ventas.margenBruto, 40);
  assert.equal(ventas.coberturaUtilidad, 1);
});

test("sucursal sin reporte o utilidad incompleta no producen cifras", () => {
  const sinNueva = ventasYMargen([ventasPorSucursal[0]], sucursales);
  assert.equal(sinNueva.ventaDiaria, null);
  assert.equal(sinNueva.margenBruto, null);
  assert.ok(sinNueva.faltantes.includes("reporte Ventas por artículo de Nueva"));

  const utilidadParcial = ventasYMargen([
    { branch_id: "A", periodo: ventasPorSucursal[0].periodo, ventas: [
      { codigo: "1", importe: 6000, utilidad: 2400 },
      { codigo: "2", importe: 4000, utilidad: 0 },
    ] },
  ], [sucursales[0]]);
  assert.equal(utilidadParcial.ventaDiaria, 1000);
  assert.equal(utilidadParcial.margenBruto, null);
  assert.ok(utilidadParcial.faltantes.includes("utilidad en 40% de la venta"));
});

test("precarga el simulador existente y da el mismo resultado que capturarlo a mano", () => {
  const real = construirEquilibrioReal({
    mes: "2026-12",
    obligaciones,
    deudas: [{ nombre: "Tarjeta", pago_mensual: 8000, estado: "ACTIVA" }],
    ventasPorSucursal,
    sucursales,
    diasAbiertos: 26,
    variablePorcentaje: 3,
  });
  assert.equal(real.calculable, true);
  assert.equal(real.tipo, "ESTIMACION");
  assert.equal(real.datos.margenBruto, "40");
  assert.equal(real.datos.diasAbiertos, "26");
  assert.equal(real.datos.ventaPrevista, "39000");
  assert.deepEqual(real.resultado, calcularEquilibrioDiario(real.datos));
  assert.equal(real.fuentes.ventas.sucursales.length, 2);
});

test("lo que falta queda vacío y listado, nunca en cero", () => {
  const real = construirEquilibrioReal({ mes: "2026-12", obligaciones, ventasPorSucursal, sucursales });
  assert.equal(real.calculable, false);
  assert.equal(real.datos.diasAbiertos, "");
  assert.equal(real.datos.variablePorcentaje, "");
  assert.equal(real.datos.deuda, "");
  assert.equal(real.datos.ventaPrevista, "");
  assert.ok(real.faltantes.includes("días que abrirás en el mes"));
  assert.ok(real.faltantes.includes("costos variables sobre ventas (comisiones, cobro con tarjeta)"));
  assert.ok(real.faltantes.includes("confirmar que no hay deudas abiertas"));
});

test("valida mes y días abiertos", () => {
  assert.equal(diasDelMes("2026-02"), 28);
  assert.equal(diasDelMes("2026-13"), null);
  const real = construirEquilibrioReal({ mes: "2026-02", diasAbiertos: 30, variablePorcentaje: 0, obligaciones, ventasPorSucursal, sucursales, sinDeudasConfirmado: true });
  assert.ok(real.faltantes.includes("días que abrirás en el mes"));
  assert.equal(construirEquilibrioReal({ mes: "dic", obligaciones }).faltantes[0], "mes del escenario");
});
