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
    [salida("impuestos", "variable", 1), NATURALEZAS.IMPUESTOS, true],
    [salida("comisiones", "variable", 1), NATURALEZAS.COMISIONES, true],
    [salida("compras_inventario", "variable", 1), NATURALEZAS.COMPRA_INVENTARIO, false],
    [salida("retiro_propietaria", "no_aplica", 1), NATURALEZAS.RETIRO_PROPIETARIA, false],
    [salida("anticipo_prestamo", "no_aplica", 1), NATURALEZAS.FINANCIAMIENTO, false],
    [salida("traspaso_caja", "no_aplica", 1), NATURALEZAS.TRASPASO, false],
    [salida("registro_prueba", "no_aplica", 1), NATURALEZAS.AJUSTE, false],
    [salida("renta", "", 1), NATURALEZAS.SIN_CLASIFICAR, false],
    [salida("sin_clasificar", "fijo", 1), NATURALEZAS.SIN_CLASIFICAR, false],
    [salida("categoria_nueva", "fijo", 1), NATURALEZAS.SIN_CLASIFICAR, false],
    [entrada("ingreso_caja_sicar", 1), NATURALEZAS.VENTA_SICAR, false],
    [entrada("traspaso_caja", 1), NATURALEZAS.TRASPASO, false],
    [entrada("anticipo_prestamo", 1), NATURALEZAS.FINANCIAMIENTO, false],
    [entrada(null, 1), NATURALEZAS.SIN_CLASIFICAR, false], // p. ej. liquidación de Mercado Libre
  ];
  for (const [movimiento, naturaleza, esGasto] of casos) {
    const resultado = clasificarMovimiento(movimiento);
    assert.equal(resultado.naturaleza, naturaleza, JSON.stringify(movimiento));
    assert.equal(resultado.esGasto, esGasto, JSON.stringify(movimiento));
  }
});

const obligaciones = [
  { categoria: "RENTA", importe: 40000, frecuencia: "MENSUAL", estado: "PENDIENTE" },
  { categoria: "NOMINA", importe: 10000, frecuencia: "SEMANAL", estado: "PENDIENTE" },
  { categoria: "SERVICIOS", importe: 800, frecuencia: "MENSUAL", estado: "PENDIENTE" },
];

test("concilia el mes: gasto real separado de retiros, compras y traspasos", () => {
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [
      salida("renta", "fijo", 40000),
      salida("nomina", "fijo", 43333.33),
      salida("servicios", "fijo", 800),
      salida("compras_inventario", "variable", 25000),
      salida("retiro_propietaria", "no_aplica", 8000),
      salida("traspaso_caja", "no_aplica", 5000),
      entrada("ingreso_caja_sicar", 90000),
      salida("renta", "fijo", 40000, { status: "Cancelado" }),
      salida("renta", "fijo", 40000, { occurred_at: "2026-11-15T18:00:00.000Z" }),
    ],
  });
  assert.equal(conciliacion.movimientosConsiderados, 7);
  assert.equal(conciliacion.gastoOperativoReal, 84133.33);
  assert.deepEqual(conciliacion.noSonGasto, { compraInventario: 25000, retiros: 8000, financiamiento: 0, traspasos: 5000 });
  assert.equal(conciliacion.porNaturaleza[NATURALEZAS.VENTA_SICAR], 90000);
  assert.equal(conciliacion.confianza, "alta");
  assert.ok(conciliacion.diferencias.every((fila) => !fila.motivo));
});

test("fecha local de Ciudad de México: 1 de enero 03:00 UTC sigue siendo diciembre", () => {
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [salida("renta", "fijo", 40000, { occurred_at: "2027-01-01T03:00:00.000Z" })],
  });
  assert.equal(conciliacion.movimientosConsiderados, 1);
});

test("confianza media con pendientes o diferencias, baja si hay sin clasificar", () => {
  const conPendiente = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [salida("renta", "fijo", 20000, { status: "Pendiente de revisión" })],
  });
  assert.equal(conPendiente.confianza, "media");
  const renta = conPendiente.diferencias.find((fila) => fila.categoria === "RENTA");
  assert.equal(renta.diferencia, -20000);
  assert.match(renta.motivo, /menor a lo esperado/);

  const conSinClasificar = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [salida("renta", "fijo", 40000), entrada(null, 12000, { concept: "Liquidación marketplace" })],
  });
  assert.equal(conSinClasificar.confianza, "baja");
  assert.equal(conSinClasificar.sinClasificar[0].concepto, "Liquidación marketplace");

  assert.equal(conciliarGastosDelMes({ mes: "2026-12", obligaciones, movimientos: [] }).confianza, "baja");
});

test("pagos sin obligación registrada se señalan", () => {
  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones: [],
    movimientos: [salida("impuestos", "variable", 3000)],
  });
  const impuestos = conciliacion.diferencias.find((fila) => fila.categoria === "IMPUESTOS");
  assert.equal(impuestos.esperado, null);
  assert.match(impuestos.motivo, /sin obligación registrada/);
});

test("el equilibrio hereda la confianza de la conciliación y nunca es alta con faltantes", () => {
  const base = {
    mes: "2026-12",
    obligaciones,
    sinDeudasConfirmado: true,
    sucursales: [{ id: "A", name: "Centro" }],
    ventasPorSucursal: [{ branch_id: "A", periodo: { fechaInicio: "2026-11-01", fechaFin: "2026-11-10" }, ventas: [{ importe: 30000, utilidad: 12000 }] }],
    diasAbiertos: 26,
    variablePorcentaje: 3,
  };
  const sinConciliar = construirEquilibrioReal(base);
  assert.equal(sinConciliar.calculable, true);
  assert.equal(sinConciliar.confianza, "baja");
  assert.match(sinConciliar.motivosConfianza[0], /Sin conciliación/);

  const conciliacion = conciliarGastosDelMes({
    mes: "2026-12",
    obligaciones,
    movimientos: [salida("renta", "fijo", 40000), salida("nomina", "fijo", 43333.33), salida("servicios", "fijo", 800)],
    gastosFijos: gastosFijosDelMes(obligaciones, "2026-12"),
  });
  const conciliado = construirEquilibrioReal({ ...base, conciliacion });
  assert.equal(conciliado.confianza, "alta");
  assert.equal(conciliado.fuentes.conciliacion.gastoOperativoReal, 84133.33);

  const incompleto = construirEquilibrioReal({ ...base, diasAbiertos: null, conciliacion });
  assert.equal(incompleto.confianza, "baja");
});
