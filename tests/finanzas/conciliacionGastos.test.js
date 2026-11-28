import test from "node:test";
import assert from "node:assert/strict";
import {
  NATURALEZAS,
  clasificarMovimiento,
  conciliarGastosDelMes,
} from "../../src/core/finanzas/conciliacionGastos.js";
import { construirEquilibrioReal, gastosFijosDelMes } from "../../src/core/finanzas/equilibrioReal.js";

// Datos sintéticos (el repositorio es público).
const salida = (categoria, comportamiento, amount, extra = {}) => ({
  movement_type: "SALIDA", expense_category: categoria, expense_behavior: comportamiento, amount,
  status: "Revisado", occurred_at: "2026-12-10T18:00:00.000Z", ...extra,
});
const entrada = (categoria, amount, extra = {}) => ({
  movement_type: "ENTRADA", expense_category: categoria, expense_behavior: "no_aplica", amount,
  status: "Revisado", occurred_at: "2026-12-10T18:00:00.000Z", ...extra,
});

test("no toda salida es gasto ni toda entrada es venta", () => {
  const casos = [
    [salida("renta", "fijo", 1), NATURALEZAS.GASTO_FIJO, true],
    [salida("marketing", "variable", 1), NATURALEZAS.GASTO_VARIABLE, true],
    [salida("nomina", "fijo", 1), NATURALEZAS.NOMINA, true],
    [salida("cuotas_imss_infonavit", "fijo", 1), NATURALEZAS.NOMINA, true],
    [salida("comisiones", "variable", 1), NATURALEZAS.COMISIONES, true],
    [salida("comisiones_marketplace", "variable", 1), NATURALEZAS.COMISIONES, true],
    // Pagos al SAT: nunca gasto operativo automático.
    [salida("impuestos", "variable", 1), NATURALEZAS.IMPUESTOS, false],
    [salida("impuesto_iva", "no_aplica", 1), NATURALEZAS.IMPUESTO_IVA, false],
    [salida("impuesto_isr", "no_aplica", 1), NATURALEZAS.IMPUESTO_ISR, false],
    // Deuda: interés es gasto financiero (no operativo); capital no es gasto.
    [salida("intereses_deuda", "fijo", 1), NATURALEZAS.INTERESES, false],
    [salida("pago_capital_deuda", "no_aplica", 1), NATURALEZAS.CAPITAL_DEUDA, false],
    [salida("compras_inventario", "variable", 1), NATURALEZAS.COMPRA_INVENTARIO, false],
    [salida("retiro_propietaria", "no_aplica", 1), NATURALEZAS.RETIRO_PROPIETARIA, false],
    [salida("anticipo_prestamo", "no_aplica", 1), NATURALEZAS.FINANCIAMIENTO, false],
    [salida("traspaso_caja", "no_aplica", 1), NATURALEZAS.TRASPASO, false],
    [salida("registro_prueba", "no_aplica", 1), NATURALEZAS.AJUSTE, false],
    [salida("renta", "", 1), NATURALEZAS.SIN_CLASIFICAR, false],
    [salida("sin_clasificar", "fijo", 1), NATURALEZAS.SIN_CLASIFICAR, false],
    [salida("categoria_nueva", "fijo", 1), NATURALEZAS.SIN_CLASIFICAR, false],
    [entrada("ingreso_caja_sicar", 1), NATURALEZAS.VENTA_SICAR, false],
    [entrada("liquidacion_marketplace", 1), NATURALEZAS.COBRO_MARKETPLACE, false],
    [entrada("traspaso_caja", 1), NATURALEZAS.TRASPASO, false],
    [entrada("anticipo_prestamo", 1), NATURALEZAS.FINANCIAMIENTO, false],
    [entrada(null, 1), NATURALEZAS.SIN_CLASIFICAR, false],
  ];
  for (const [movimiento, naturaleza, esGasto] of casos) {
    const resultado = clasificarMovimiento(movimiento);
    assert.equal(resultado.naturaleza, naturaleza, JSON.stringify(movimiento));
    assert.equal(resultado.esGasto, esGasto, JSON.stringify(movimiento));
  }
});

const obligaciones = [
  { categoria: "RENTA", importe: 40000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-11-05", estado: "PENDIENTE" },
  { categoria: "NOMINA", importe: 10000, frecuencia: "SEMANAL", fecha_vencimiento: "2026-11-27", estado: "PENDIENTE" },
  { categoria: "SERVICIOS", importe: 800, frecuencia: "MENSUAL", fecha_vencimiento: "2026-11-10", estado: "PENDIENTE" },
];

const mesCompleto = [
  salida("renta", "fijo", 40000),
  salida("nomina", "fijo", 40000),
  salida("servicios", "fijo", 800),
];

test("concilia el mes: gasto separado de retiros, compras, capital, impuestos y cobros", () => {
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [
      ...mesCompleto,
      salida("intereses_deuda", "fijo", 2400),
      salida("pago_capital_deuda", "no_aplica", 5600),
      salida("impuesto_iva", "no_aplica", 3000),
      salida("compras_inventario", "variable", 25000),
      salida("retiro_propietaria", "no_aplica", 8000),
      salida("traspaso_caja", "no_aplica", 5000),
      entrada("ingreso_caja_sicar", 90000),
      entrada("liquidacion_marketplace", 12000),
      salida("renta", "fijo", 40000, { status: "Cancelado" }),
      salida("renta", "fijo", 40000, { occurred_at: "2026-11-15T18:00:00.000Z" }),
    ],
  });
  assert.equal(conciliacion.gastoOperativoReal, 80800);
  assert.equal(conciliacion.gastoFinanciero, 2400);
  assert.deepEqual(conciliacion.impuestos, { sinTipo: 0, iva: 3000, isr: 0 });
  assert.deepEqual(conciliacion.noSonGasto, { compraInventario: 25000, retiros: 8000, financiamiento: 0, capitalDeuda: 5600, traspasos: 5000 });
  assert.deepEqual(conciliacion.noSonVenta, { cobrosMarketplace: 12000, ventaYaEnSicar: 90000 });
  assert.equal(conciliacion.confianza, "alta");
});

test("devengado del calendario contra pagado y pendiente, a nivel categoría", () => {
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [salida("renta", "fijo", 40000), salida("nomina", "fijo", 20000), salida("servicios", "fijo", 800)],
  });
  const nomina = conciliacion.diferencias.find((fila) => fila.categoria === "NOMINA");
  assert.equal(nomina.devengado, 40000); // 4 semanas en diciembre
  assert.equal(nomina.pagado, 20000);
  assert.equal(nomina.pendiente, 20000);
  assert.equal(nomina.nivel, "categoria");
  assert.match(nomina.motivo, /menor a lo que vence/);
  assert.equal(conciliacion.confianza, "media");
  assert.ok(conciliacion.limites[0].includes("no prueba que cada obligación individual"));
});

test("sin movimientos no es gasto cero", () => {
  const conciliacion = conciliarGastosDelMes({ mes: "2026-12", obligaciones, movimientos: [] });
  assert.equal(conciliacion.gastoOperativoReal, null);
  assert.equal(conciliacion.noSonGasto, null);
  assert.equal(conciliacion.confianza, "baja");
  const renta = conciliacion.diferencias.find((fila) => fila.categoria === "RENTA");
  assert.equal(renta.pagado, null);
  assert.equal(renta.pendiente, null);
});

test("pago al SAT sin tipo baja la confianza a media y no suma a gasto", () => {
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [...mesCompleto, salida("impuestos", "variable", 6000)],
  });
  assert.equal(conciliacion.gastoOperativoReal, 80800);
  assert.equal(conciliacion.impuestos.sinTipo, 6000);
  assert.equal(conciliacion.confianza, "media");
  assert.ok(conciliacion.motivosConfianza.some((texto) => texto.includes("SAT")));
});

test("fecha local de Ciudad de México: 1 de enero 03:00 UTC sigue siendo diciembre", () => {
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [salida("renta", "fijo", 40000, { occurred_at: "2027-01-01T03:00:00.000Z" })],
  });
  assert.equal(conciliacion.movimientosConsiderados, 1);
});

test("sin clasificar o pendientes bajan la confianza", () => {
  assert.equal(conciliarGastosDelMes({
    mes: "2026-12", obligaciones,
    movimientos: [...mesCompleto, entrada(null, 12000, { concept: "Depósito sin identificar" })],
  }).confianza, "baja");
  assert.equal(conciliarGastosDelMes({
    mes: "2026-12", obligaciones,
    movimientos: [...mesCompleto.slice(0, 2), salida("servicios", "fijo", 800, { status: "Pendiente de revisión" })],
  }).confianza, "media");
});

test("pagos sin obligación que venza en el mes se señalan", () => {
  const conciliacion = conciliarGastosDelMes({ mes: "2026-12", obligaciones: [], movimientos: [salida("servicios", "fijo", 3000)] });
  const servicios = conciliacion.diferencias.find((fila) => fila.categoria === "SERVICIOS");
  assert.equal(servicios.devengado, null);
  assert.match(servicios.motivo, /sin obligación/);
});

test("el equilibrio usa la conciliación y nunca es alta con faltantes", () => {
  const entradaEquilibrio = {
    mes: "2026-12",
    hoy: "2027-01-05T18:00:00Z",
    obligaciones,
    sinDeudasConfirmado: true,
    sucursales: [{ id: "A", name: "Centro" }],
    ventasPorSucursal: [{ branch_id: "A", periodo: { fechaInicio: "2026-11-01", fechaFin: "2026-11-10" }, ventas: [{ importe: 30000, utilidad: 12000, importeDisponible: true, utilidadDisponible: true }] }],
    diasAbiertos: 26,
    diasAbiertosMes: { A: 26 },
    diasAbiertosPeriodo: { A: 10 },
    variablePorcentaje: 3,
  };
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12", obligaciones, movimientos: mesCompleto, gastosFijos: gastosFijosDelMes(obligaciones, "2026-12"),
  });
  const conciliado = construirEquilibrioReal({ ...entradaEquilibrio, conciliacion });
  assert.equal(conciliado.confianza, "alta");
  assert.equal(conciliado.gastos.pagadoOperativo, 80800);
  assert.equal(conciliado.gastos.devengadoOperativoDelMes, 80800);
  assert.equal(construirEquilibrioReal(entradaEquilibrio).confianza, "baja");
  assert.equal(construirEquilibrioReal({ ...entradaEquilibrio, diasAbiertos: null, conciliacion }).confianza, "baja");
});
