import test from "node:test";
import assert from "node:assert/strict";
import {
  agregarVentasSicarPorMes,
  analizarRentabilidad,
  compararMeses,
  construirEstadoResultados,
  efectoVolumenMargen,
} from "../../src/core/finanzas/estadoResultados.js";

// Todo es sintético.
const sucursales = [{ id: "s1", name: "Centro" }, { id: "s2", name: "Plaza" }];

const filasSicar = (mes, centro, plaza) => [
  { branch_id: "s1", fecha: `${mes}-05`, importe: centro.venta, utilidad: centro.utilidad },
  { branch_id: "s2", fecha: `${mes}-06`, importe: plaza.venta, utilidad: plaza.utilidad },
];

const mov = (id, mes, categoria, amount, extra = {}) => ({
  id, movement_type: "salida", amount, expense_category: categoria, status: "revisado", occurred_at: `${mes}-10T18:00:00Z`, ...extra,
});

const canalML = (extra = {}) => ({
  canal: "mercado_libre",
  ventasPagadas: 20000,
  comisiones: 3000,
  envios: 2000,
  tasaCancelacionPct: 8,
  cargosPct: 25,
  porSku: [
    { sku: "A", costoProducto: 9000, utilidad: 4000 },
    { sku: "B", costoProducto: 1000, utilidad: -300, pierdeDinero: true },
  ],
  productosConPerdida: [{ sku: "B", titulo: "Rímel paquete", utilidad: -300, unidades: 12 }],
  ...extra,
});

function estado(mes, { centro, plaza, movimientos, canal = canalML(), publicidad = 1000, isr = { tasaEstimadaPct: 30 }, intereses = {}, hoy = "2026-12-15", baseIvaSicar = { base: "sin_iva" } }) {
  return construirEstadoResultados({
    businessId: "monys",
    mes,
    sucursales,
    ventasSucursal: agregarVentasSicarPorMes(filasSicar(mes, centro, plaza)),
    canales: canal ? [{ resumen: canal, publicidad, baseIva: { base: "sin_iva" } }] : [],
    movimientos,
    baseIvaSicar,
    intereses,
    isr,
    hoy,
  });
}

const movsOct = [
  mov("r1", "2026-10", "renta", 15000, { branch_id: "s1", expense_behavior: "fijo" }),
  mov("r2", "2026-10", "renta", 10000, { branch_id: "s2", expense_behavior: "fijo" }),
  mov("n1", "2026-10", "nomina", 20000, { branch_id: "s1" }),
  mov("n2", "2026-10", "nomina", 15000, { branch_id: "s2" }),
  mov("g1", "2026-10", "servicios", 3000, { expense_behavior: "fijo" }), // general
  mov("i1", "2026-10", "intereses_deuda", 4000),
  mov("k1", "2026-10", "pago_capital_deuda", 8000),
  mov("v1", "2026-10", "impuesto_iva", 6000),
  mov("c1", "2026-10", "compras_inventario", 50000),
  mov("x1", "2026-10", "comisiones_marketplace", 3000), // duplicado de las órdenes
];

test("estado de resultados: cada renglón en su lugar y nada que no es gasto resta", () => {
  const e = estado("2026-10", { centro: { venta: 100000, utilidad: 45000 }, plaza: { venta: 60000, utilidad: 24000 }, movimientos: movsOct });
  const c = e.consolidado;
  // Ingresos: 100 000 + 60 000 + 20 000 (ML)
  assert.equal(c.ingresos, 180000);
  // Costo: 55 000 + 36 000 + 10 000
  assert.equal(c.costoMercancia, 101000);
  assert.equal(c.utilidadBruta, 79000);
  // Gastos: canal 6 000 + directos 60 000 + generales 3 000
  assert.equal(c.gastosOperativos.ventaCanales, 6000);
  assert.equal(c.gastosOperativos.directosSucursales, 60000);
  assert.equal(c.gastosOperativos.generales, 3000);
  assert.equal(c.utilidadOperativa, 10000);
  assert.equal(c.intereses, 4000);
  assert.equal(c.utilidadAntesISR, 6000);
  assert.equal(c.isr, 1800);
  assert.equal(c.tipoIsr, "ESTIMADO");
  assert.equal(c.utilidadNeta, 4200);
  // No son gasto: capital, IVA, inventario.
  assert.equal(e.noSonGasto.capitalDeuda, 8000);
  assert.equal(e.noSonGasto.iva, 6000);
  assert.equal(e.noSonGasto.compraInventario, 50000);
  // La comisión de ML en Tesorería no se resta dos veces.
  assert.equal(e.excluidosPorDuplicado.length, 1);
  // Por unidad.
  const [centro, plaza, ml] = e.unidades;
  assert.equal(centro.contribucion, 10000);
  assert.equal(plaza.contribucion, -1000);
  assert.equal(ml.contribucion, 4000);
  assert.equal(ml.gastosVenta.total, 6000);
  // Generales: solo como supuesto, aparte.
  assert.equal(e.repartoGeneralesPorVentas.tipo, "SUPUESTO");
  assert.equal(e.confianza, "media"); // ISR estimado e intereses pagados
});

test("dato faltante no es cero: sucursal sin ventas, publicidad o costos desconocidos", () => {
  const sinPlaza = construirEstadoResultados({
    businessId: "monys", mes: "2026-10", sucursales,
    ventasSucursal: agregarVentasSicarPorMes([{ branch_id: "s1", fecha: "2026-10-05", importe: 100, utilidad: 40 }]),
    movimientos: [], baseIvaSicar: { base: "sin_iva" }, isr: { tasaEstimadaPct: 30 },
  });
  assert.equal(sinPlaza.consolidado.ingresos, null);
  assert.ok(sinPlaza.faltantes.some((f) => f.includes("Plaza")));
  // Cerrada confirmada sí cuenta como cero.
  const cerrada = construirEstadoResultados({
    businessId: "monys", mes: "2026-10", sucursales: [sucursales[0], { ...sucursales[1], cerradaConfirmada: true }],
    ventasSucursal: agregarVentasSicarPorMes([{ branch_id: "s1", fecha: "2026-10-05", importe: 100, utilidad: 40 }]),
    movimientos: [], baseIvaSicar: { base: "sin_iva" },
  });
  assert.equal(cerrada.consolidado.ingresos, 100);
  // Publicidad desconocida: la contribución del canal queda pendiente.
  const sinAds = estado("2026-10", { centro: { venta: 1, utilidad: 1 }, plaza: { venta: 1, utilidad: 1 }, movimientos: [], publicidad: null });
  assert.equal(sinAds.unidades[2].contribucion, null);
  assert.ok(sinAds.faltantes.some((f) => f.includes("publicidad")));
  // SKU sin costo SICAR: utilidad bruta del canal pendiente.
  const sinCosto = estado("2026-10", { centro: { venta: 1, utilidad: 1 }, plaza: { venta: 1, utilidad: 1 }, movimientos: [], canal: canalML({ porSku: [{ sku: "A", costoProducto: null }] }) });
  assert.equal(sinCosto.unidades[2].utilidadBruta, null);
  // Renglón SICAR sin utilidad disponible.
  const incompleta = agregarVentasSicarPorMes([{ branch_id: "s1", fecha: "2026-10-05", importe: 100, utilidad: 40, utilidad_disponible: false }]);
  assert.equal(incompleta[0].ingresos, null);
  // Sin movimientos de Tesorería: gastos y utilidad operativa pendientes.
  const sinTesoreria = estado("2026-10", { centro: { venta: 10, utilidad: 5 }, plaza: { venta: 10, utilidad: 5 }, movimientos: null });
  assert.equal(sinTesoreria.consolidado.utilidadOperativa, null);
  assert.equal(sinTesoreria.confianza, "baja");
});

test("IVA: sin confirmar no calcula ISR; con IVA incluido se desglosa", () => {
  const porConfirmar = estado("2026-10", { centro: { venta: 116000, utilidad: 50000 }, plaza: { venta: 0, utilidad: 0 }, movimientos: movsOct, baseIvaSicar: {} });
  assert.equal(porConfirmar.consolidado.isr, null);
  assert.equal(porConfirmar.consolidado.utilidadNeta, null);
  assert.equal(porConfirmar.confianza, "baja");
  assert.ok(porConfirmar.faltantes.some((f) => f.includes("incluyen IVA")));
  const conIva = estado("2026-10", { centro: { venta: 116000, utilidad: 50000 }, plaza: { venta: 0, utilidad: 0 }, movimientos: movsOct, baseIvaSicar: { base: "con_iva", ivaPct: 16 } });
  assert.equal(conIva.unidades[0].ingresos, 100000);
});

test("ISR del contador tiene prioridad e intereses devengados reemplazan a los pagados", () => {
  const e = estado("2026-10", {
    centro: { venta: 100000, utilidad: 45000 }, plaza: { venta: 60000, utilidad: 24000 }, movimientos: movsOct,
    isr: { montoDelContador: 1200, tasaEstimadaPct: 30 }, intereses: { devengados: 4500 },
  });
  assert.equal(e.consolidado.isr, 1200);
  assert.equal(e.consolidado.tipoIsr, "DEL_CONTADOR");
  assert.equal(e.consolidado.intereses, 4500);
  assert.equal(e.bases.intereses, "devengado");
});

test("efecto volumen y margen suman exactamente el cambio de utilidad bruta", () => {
  const ef = efectoVolumenMargen({ ingresos: 100000, utilidadBruta: 45000 }, { ingresos: 90000, utilidadBruta: 36000 });
  assert.equal(ef.volumen, -4500); // −10 000 × 45%
  assert.equal(ef.margen, -4500); // 90 000 × (40% − 45%)
  assert.equal(ef.volumen + ef.margen, ef.total);
  assert.equal(efectoVolumenMargen({ ingresos: null, utilidadBruta: 1 }, { ingresos: 1, utilidadBruta: 1 }), null);
});

const movsNov = movsOct.map((m) => ({ ...m, id: `${m.id}n`, occurred_at: m.occurred_at.replace("2026-10", "2026-11") }))
  .map((m) => (m.id === "n2n" ? { ...m, amount: 23000 } : m)); // nómina de Plaza sube 8 000

test("comparativo mensual: variaciones, margen en puntos, gastos y mes parcial", () => {
  const oct = estado("2026-10", { centro: { venta: 100000, utilidad: 45000 }, plaza: { venta: 60000, utilidad: 24000 }, movimientos: movsOct });
  const nov = estado("2026-11", { centro: { venta: 90000, utilidad: 36000 }, plaza: { venta: 60000, utilidad: 24000 }, movimientos: movsNov });
  const dic = estado("2026-12", { centro: { venta: 10, utilidad: 5 }, plaza: { venta: 10, utilidad: 5 }, movimientos: [] });
  const comp = compararMeses([dic, nov, oct]);
  const [m1, m2, m3] = comp.meses;
  assert.equal(m1.mes, "2026-10");
  assert.equal(m1.vsMesAnterior, null);
  assert.deepEqual(m2.vsMesAnterior.ingresos, { delta: -10000, pct: -5.6 });
  assert.equal(m2.efectoUtilidadBruta.total, -9000);
  const centro = m2.unidades.find((u) => u.unidad === "s1");
  assert.equal(centro.margenBrutoPp, -5);
  assert.equal(m2.gastos[0].categoria, "nomina");
  assert.equal(m2.gastos[0].delta, 8000);
  // Diciembre está en curso: no se compara.
  assert.equal(m3.parcial, true);
  assert.equal(m3.vsMesAnterior, null);
  assert.ok(m3.noComparableMotivo);
  // Estados de dos negocios no se mezclan.
  assert.equal(compararMeses([oct, { ...nov, businessId: "flotilla" }]).calculable, false);
});

test("recomendaciones con impacto estimado, sin ejecutar nada", () => {
  const oct = estado("2026-10", { centro: { venta: 100000, utilidad: 45000 }, plaza: { venta: 60000, utilidad: 24000 }, movimientos: movsOct });
  const nov = estado("2026-11", { centro: { venta: 90000, utilidad: 36000 }, plaza: { venta: 60000, utilidad: 24000 }, movimientos: movsNov });
  const { recomendaciones } = analizarRentabilidad([oct, nov]);
  const claves = recomendaciones.map((r) => r.clave);
  assert.ok(claves.includes("contribucion_negativa:s2"));
  assert.ok(claves.includes("margen_bruto:s1"));
  assert.ok(claves.includes("gasto:nomina"));
  assert.ok(claves.includes("productos_con_perdida:mercado_libre"));
  assert.ok(claves.includes("cancelaciones:mercado_libre"));
  assert.ok(recomendaciones.every((r) => r.requiereAutorizacion && r.tipo === "RECOMENDACION"));
  const plaza = recomendaciones.find((r) => r.clave === "contribucion_negativa:s2");
  assert.equal(plaza.impactoMensual, 9000); // 24 000 − 10 000 − 23 000
  const margen = recomendaciones.find((r) => r.clave === "margen_bruto:s1");
  assert.equal(margen.impactoMensual, 4500);
  // Orden por impacto.
  const impactos = recomendaciones.map((r) => r.impactoMensual ?? -1);
  assert.deepEqual(impactos, [...impactos].sort((a, b) => b - a));
});

test("sin negocio o mes inválido no calcula", () => {
  assert.equal(construirEstadoResultados({ mes: "2026-10" }).calculable, false);
  assert.equal(construirEstadoResultados({ businessId: "x", mes: "2026-13" }).calculable, false);
});

test("dos cargas de SICAR del mismo día no se suman: gana la más reciente", async () => {
  const { filasSinCargasDuplicadas } = await import("../../src/core/finanzas/estadoResultados.js");
  const importaciones = [
    { id: "i1", branch_id: "s1", created_at: "2026-11-02T10:00:00Z" },
    { id: "i2", branch_id: "s1", created_at: "2026-11-03T10:00:00Z" }, // recarga corregida
    { id: "i3", branch_id: "s2", created_at: "2026-11-01T10:00:00Z" },
  ];
  const filas = [
    { importacion_id: "i1", fecha: "2026-11-01", importe: 100, utilidad: 40 },
    { importacion_id: "i1", fecha: "2026-11-02", importe: 50, utilidad: 20 },
    { importacion_id: "i2", fecha: "2026-11-01", importe: 110, utilidad: 44 },
    { importacion_id: "i3", fecha: "2026-11-01", importe: 70, utilidad: 30 },
    { importacion_id: "zz", fecha: "2026-11-01", importe: 999, utilidad: 1 }, // carga ajena
  ];
  const { filas: elegidas, descartadas } = filasSinCargasDuplicadas(filas, importaciones);
  assert.equal(descartadas, 2);
  const [s1] = agregarVentasSicarPorMes(elegidas).filter((g) => g.unidad === "s1");
  assert.equal(s1.ingresos, 160); // 110 (i2, día 1) + 50 (i1, día 2)
});

test("canal sin sincronizar: sucursales sí, consolidado pendiente", () => {
  const e = construirEstadoResultados({
    businessId: "monys", mes: "2026-10", sucursales,
    ventasSucursal: agregarVentasSicarPorMes(filasSicar("2026-10", { venta: 100, utilidad: 40 }, { venta: 50, utilidad: 20 })),
    movimientos: [], baseIvaSicar: { base: "sin_iva" }, canalesSinDatos: ["mercado_libre"],
  });
  assert.equal(e.unidades[0].utilidadBruta, 40);
  assert.equal(e.consolidado.ingresos, null);
  assert.equal(e.confianza, "baja");
  assert.ok(e.faltantes.some((f) => f.includes("mercado_libre")));
});
