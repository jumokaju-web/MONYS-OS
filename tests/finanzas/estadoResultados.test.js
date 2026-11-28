import test from "node:test";
import assert from "node:assert/strict";
import {
  analizarRentabilidad,
  compararMeses,
  construirEstadoResultados,
  efectoVolumenMargen,
  elegirCargasPorDia,
  ventasSucursalDelMes,
} from "../../src/core/finanzas/estadoResultados.js";
import { calendarioDelNegocio } from "../../src/core/operacion/calendarioOperativo.js";

// Todo es sintético.
const sucursales = [{ id: "s1", name: "Centro", active: true }, { id: "s2", name: "Plaza", active: true }];
const finDe = (mes) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).toISOString().slice(0, 10);
const r = (v) => Math.round(v * 100) / 100;

// Una carga por sucursal que cubre el mes completo, hecha dos días después del cierre.
function cargasDelMes(mes, ventas) {
  const creada = new Date(Date.parse(`${finDe(mes)}T12:00:00Z`) + 2 * 86400000).toISOString();
  const importaciones = [];
  const filas = [];
  for (const [branch, v] of Object.entries(ventas)) {
    const id = `${branch}-${mes}`;
    importaciones.push({ id, branch_id: branch, created_at: creada, periodoInicio: `${mes}-01`, periodoFin: finDe(mes) });
    filas.push({ importacion_id: id, fecha: `${mes}-05`, importe: v.venta, utilidad: v.utilidad, importe_disponible: true, utilidad_disponible: true });
  }
  return { importaciones, filas };
}

const mov = (id, mes, categoria, amount, extra = {}) => ({
  id, organization_id: "o", business_id: "monys", movement_type: "salida", amount, expense_category: categoria, status: "revisado", occurred_at: `${mes}-10T18:00:00Z`, ...extra,
});

const movimientosDe = (mes, { nominaPlaza = 15000 } = {}) => [
  mov("r1", mes, "renta", 15000, { branch_id: "s1", expense_behavior: "fijo" }),
  mov("n1", mes, "nomina", 20000, { branch_id: "s1" }),
  mov("n2", mes, "nomina", nominaPlaza, { branch_id: "s2" }),
  // La renta de Plaza no se registró: la obligación la deja pendiente.
  mov("g1", mes, "servicios", 3000, { expense_behavior: "fijo" }),
  mov("i1", mes, "intereses_deuda", 4000),
  mov("k1", mes, "pago_capital_deuda", 8000),
  mov("v1", mes, "impuesto_iva", 6000),
  mov("c1", mes, "compras_inventario", 50000),
  mov("x1", mes, "comisiones_marketplace", 3000), // ya viene en las órdenes (vínculo verificado)
  mov("x2", mes, "comisiones_marketplace", 500), // cargo distinto de la cuenta (almacenaje, p. ej.)
  mov("x3", mes, "comisiones_marketplace", 200), // sin ligar
];

const obligaciones = [
  { business_id: "monys", branch_id: "s1", categoria: "RENTA", importe: 15000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-05" },
  { business_id: "monys", branch_id: "s2", categoria: "RENTA", importe: 10000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-05" },
  { business_id: "monys", branch_id: "s1", categoria: "NOMINA", importe: 20000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-30" },
  { business_id: "monys", branch_id: "s2", categoria: "NOMINA", importe: 15000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-30" },
  { business_id: "monys", categoria: "SERVICIOS", importe: 3000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-10" },
  { business_id: "flotilla", categoria: "RENTA", importe: 99999, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-01" },
];

const canalML = (extra = {}) => ({
  cuentaId: "ml1",
  cuentaExterna: "123",
  coberturaCompleta: true,
  publicidad: 1000,
  operaciones: ["ORD-1", "ORD-2"],
  baseIvaVentas: { base: "sin_iva" },
  baseIvaCargos: { base: "sin_iva" },
  resumen: {
    canal: "mercado_libre",
    ventasPagadas: 20000,
    comisiones: 3000,
    envios: 2000,
    tasaCancelacionPct: 8,
    cargosPct: 25,
    porSku: [{ sku: "A", costoProducto: 9000, utilidad: 4000 }, { sku: "B", costoProducto: 1000, utilidad: -300 }],
    productosConPerdida: [{ sku: "B", titulo: "Rímel paquete", utilidad: -300, unidades: 12 }],
  },
  ...extra,
});

const vinculo = (movId, tipo, referencia, monto, estado = "verificado") => ({ id: `v-${movId}`, cash_movement_id: movId, business_id: "monys", cuenta_id: "ml1", tipo_operacion: tipo, referencia_externa: referencia, monto_conciliado: monto, estado });
const vinculosDe = (mes) => [vinculo(`x1`, "comision", "ORD-1", 3000), vinculo(`x2`, "cargo_plataforma", "FACT-NOV", 500)];

const basesSinIva = { ventasSicar: { base: "sin_iva" }, costoSicar: { base: "sin_iva" }, gastosTesoreria: { base: "sin_iva" } };
const configML = [{ id: "ml1", canal: "mercado_libre", cuenta_externa: "123" }];

function estado(mes, { ventas = { s1: { venta: 100000, utilidad: 45000 }, s2: { venta: 60000, utilidad: 24000 } }, movimientos = movimientosDe(mes), canales = [canalML()], configurados = configML, bases = basesSinIva, isr = { tasaEstimadaPct: 30 }, vinculosPlataforma = vinculosDe(mes), calendario = null } = {}) {
  const { importaciones, filas } = cargasDelMes(mes, ventas);
  return construirEstadoResultados({
    businessId: "monys", mes, sucursales, sicar: elegirCargasPorDia(filas, importaciones),
    canales, canalesConfigurados: configurados, movimientos, obligaciones, bases, isr, hoy: "2026-12-15", vinculosPlataforma, calendario,
  });
}

test("estado completo: renglones, tres bases de gasto y lo que no es gasto", () => {
  const e = estado("2026-10");
  const c = e.consolidado;
  assert.equal(c.completo, true);
  assert.equal(c.ingresos, 180000);
  assert.equal(c.costoMercancia, 101000);
  assert.equal(c.utilidadBruta, 79000);
  assert.equal(c.gastosVenta, 6000);
  // Pagado: Centro 35 000, Plaza 15 000, ML cargo distinto 500.
  assert.equal(c.gastosDirectos.pagado, 50500);
  // Devengado: Plaza lleva su renta de 10 000 por obligación.
  assert.equal(c.gastosDirectos.devengado, 60500);
  assert.equal(c.gastosGenerales.pagado, 3200); // servicios 3 000 + cargo sin ligar 200
  assert.equal(c.utilidadOperativa.pagado, 19300);
  assert.equal(c.utilidadOperativa.devengado, 9300);
  assert.equal(e.bases.utilidadOperativa, "devengado");
  assert.equal(c.intereses, 4000);
  assert.equal(c.utilidadAntesISR, 5300);
  assert.equal(c.isr, 1590);
  assert.equal(c.utilidadNeta, 3710);
  assert.equal(e.obligacionesPendientes, 10000);
  const plaza = e.unidades.find((u) => u.unidad === "s2");
  assert.deepEqual(plaza.gastosDirectos.porCategoria.find((f) => f.categoria === "RENTA"), { categoria: "RENTA", pagado: 0, devengado: 10000, vence: 10000, pendiente: 10000, fuente: "obligacion" });
  assert.equal(e.noSonGasto.capitalDeuda, 8000);
  assert.equal(e.noSonGasto.iva, 6000);
  assert.equal(e.noSonGasto.compraInventario, 50000);
  assert.ok(!JSON.stringify(e).includes("99999")); // obligación de flotilla
});

test("comisiones de marketplace: solo se excluye lo verificado y ligado a una operación de las órdenes", () => {
  const e = estado("2026-10");
  assert.deepEqual(e.cargosMarketplace.excluidosPorDuplicado.map((x) => x.id), ["x1"]);
  assert.deepEqual(e.cargosMarketplace.porConciliar.map((x) => [x.id, x.estado]), [["x2", "sin_conciliar"], ["x3", "sin_conciliar"]]);
  // Vínculo propuesto (sin verificar): no se excluye.
  const propuesto = estado("2026-10", { vinculosPlataforma: [vinculo("x1", "comision", "ORD-1", 3000, "propuesto")] });
  assert.equal(propuesto.cargosMarketplace.excluidosPorDuplicado.length, 0);
  // Conciliación parcial: 1 000 de 3 000 ya están en órdenes.
  const parcial = estado("2026-10", { vinculosPlataforma: [vinculo("x1", "comision", "ORD-1", 1000)] });
  assert.equal(parcial.cargosMarketplace.excluidosPorDuplicado[0].importe, 1000);
  assert.equal(parcial.cargosMarketplace.porConciliar.find((x) => x.id === "x1").importe, 2000);
  // Sin tabla de conciliación: nada se excluye y se avisa.
  const sinTabla = estado("2026-10", { vinculosPlataforma: null });
  assert.equal(sinTabla.cargosMarketplace.excluidosPorDuplicado.length, 0);
  assert.ok(sinTabla.provisional.some((p) => p.includes("Conciliación de plataformas no disponible")));
  const ml = e.unidades.find((u) => u.tipo === "canal");
  assert.equal(ml.gastosDirectos.porCategoria.find((f) => f.categoria === "CARGOS_MARKETPLACE").pagado, 500);
  assert.equal(e.generales.porCategoria.find((f) => f.categoria === "CARGOS_MARKETPLACE").pagado, 200);
  const sinComision = estado("2026-10", { canales: [canalML({ resumen: { ...canalML().resumen, comisiones: null } })] });
  assert.equal(sinComision.cargosMarketplace.excluidosPorDuplicado.length, 0);
});

test("cobertura diaria: un día sin carga deja el mes pendiente pero conserva lo registrado", () => {
  const { importaciones, filas } = cargasDelMes("2026-10", { s1: { venta: 100, utilidad: 40 } });
  importaciones[0].periodoFin = "2026-10-29";
  const sicar = elegirCargasPorDia(filas, importaciones);
  const v = ventasSucursalDelMes({ branchId: "s1", mes: "2026-10", ...sicar });
  assert.equal(v.cobertura.completa, false);
  assert.deepEqual(v.cobertura.diasSinDato, ["2026-10-30", "2026-10-31"]);
  assert.equal(v.ingresosRegistrados, 100);
  const cerrada = ventasSucursalDelMes({ branchId: "s1", mes: "2026-10", ...sicar, diasCerrados: ["2026-10-30", "2026-10-31"] });
  assert.equal(cerrada.cobertura.completa, true);
  const e = construirEstadoResultados({
    businessId: "monys", mes: "2026-10", sucursales: [sucursales[0]], sicar, canalesConfigurados: [], movimientos: [], bases: basesSinIva,
  });
  assert.equal(e.unidades[0].ingresos, null);
  assert.equal(e.unidades[0].ingresosRegistrados, 100);
  assert.equal(e.subtotalConocido.ingresosRegistrados.valor, 100);
  assert.equal(e.consolidado.ingresos, null);
  assert.ok(e.faltantes.some((f) => f.includes("2 día(s) sin carga")));
});

test("una carga parcial no reemplaza un día completo; cargas completas distintas = conflicto", () => {
  const completa = { id: "a", branch_id: "s1", created_at: "2026-11-02T12:00:00Z", periodoInicio: "2026-10-01", periodoFin: "2026-10-31" };
  const parcial = { id: "b", branch_id: "s1", created_at: "2026-11-03T02:00:00Z", periodoInicio: "2026-10-31", periodoFin: "2026-10-31" }; // 20:00 del 2 nov local; cubre el 31 completo
  const parcialDelDia = { id: "b", branch_id: "s1", created_at: "2026-10-31T20:00:00Z", periodoInicio: "2026-10-31", periodoFin: "2026-10-31" }; // sacada antes de cerrar el día
  const filas = [
    { importacion_id: "a", fecha: "2026-10-31", importe: 500, utilidad: 200, importe_disponible: true, utilidad_disponible: true },
    { importacion_id: "b", fecha: "2026-10-31", importe: 300, utilidad: 100, importe_disponible: true, utilidad_disponible: true },
  ];
  // Más nueva pero parcial: gana la completa.
  const r1 = elegirCargasPorDia(filas, [completa, parcialDelDia]);
  assert.equal(r1.dias.get("s1|2026-10-31"), "completo");
  assert.deepEqual(r1.filas.map((f) => f.importacion_id), ["a"]);
  // Dos completas con totales distintos: conflicto (y gana la más nueva).
  const r2 = elegirCargasPorDia(filas, [completa, parcial]);
  assert.equal(r2.dias.get("s1|2026-10-31"), "conflicto");
  assert.deepEqual(r2.filas.map((f) => f.importacion_id), ["b"]);
  // Solo parciales: el día queda parcial.
  const r3 = elegirCargasPorDia(filas.slice(1), [parcialDelDia]);
  assert.equal(r3.dias.get("s1|2026-10-31"), "parcial");
  // Sin periodo declarado: sin confirmar.
  const r4 = elegirCargasPorDia(filas.slice(0, 1), [{ id: "a", branch_id: "s1", created_at: "2026-11-02T12:00:00Z" }]);
  assert.equal(r4.dias.get("s1|2026-10-31"), "sin_confirmar");
});

test("importe y utilidad por separado; bandera null con 0 es desconocido", () => {
  const importaciones = [{ id: "a", branch_id: "s1", created_at: "2026-11-02T12:00:00Z", periodoInicio: "2026-10-01", periodoFin: "2026-10-31" }];
  const filas = [
    { importacion_id: "a", fecha: "2026-10-05", importe: 100, utilidad: 40, importe_disponible: true, utilidad_disponible: false },
    { importacion_id: "a", fecha: "2026-10-06", importe: 50, utilidad: 0 }, // histórico: 0 sin bandera = desconocido
    { importacion_id: "a", fecha: "2026-10-07", importe: 70, utilidad: 30 }, // histórico con valores: cuenta, marcado
  ];
  const v = ventasSucursalDelMes({ branchId: "s1", mes: "2026-10", ...elegirCargasPorDia(filas, importaciones) });
  assert.equal(v.ingresos, 220);
  assert.equal(v.costoMercancia, null);
  assert.equal(v.renglonesSinUtilidad, 2);
  assert.equal(v.renglonesSinBandera, 2);
});

test("Tesorería vacía no prueba cero: el devengado sale de las obligaciones", () => {
  const e = estado("2026-10", { movimientos: [] });
  assert.equal(e.consolidado.gastosDirectos.pagado, 0);
  assert.equal(e.consolidado.gastosDirectos.devengado, 60000);
  assert.equal(e.obligacionesPendientes, 63000);
  assert.ok(e.provisional.some((p) => p.includes("no está confirmado como completo")));
  assert.notEqual(e.confianza, "alta");
  const sin = estado("2026-10", { movimientos: null });
  assert.equal(sin.consolidado.utilidadBruta, 79000);
  assert.equal(sin.consolidado.utilidadOperativa.pagado, null);
  assert.equal(sin.confianza, "baja");
});

test("bases de IVA independientes; resultado provisional si alguna falta", () => {
  const e = estado("2026-10", {
    bases: { ventasSicar: { base: "con_iva", ivaPct: 16 }, costoSicar: {}, gastosTesoreria: { base: "sin_iva" } },
    ventas: { s1: { venta: 116000, utilidad: 50000 }, s2: { venta: 0, utilidad: 0 } },
  });
  const centro = e.unidades.find((u) => u.unidad === "s1");
  assert.equal(centro.ingresos, 100000);
  assert.equal(centro.costoMercancia, 66000); // tal como viene: su base está por confirmar
  assert.equal(e.bases.iva.ventasSicar, "con_iva");
  assert.equal(e.bases.iva.costoSicar, "por_confirmar");
  assert.equal(e.consolidado.tipoIsr, "ESTIMADO_PROVISIONAL");
  assert.ok(e.provisional.some((p) => p.includes("costoSicar")));
  const sinPct = estado("2026-10", { bases: { ...basesSinIva, ventasSicar: { base: "con_iva" } } });
  assert.equal(sinPct.bases.iva.ventasSicar, "por_confirmar");
});

test("canales: solo cuentas configuradas del negocio; sin configuración el consolidado espera", () => {
  const ajeno = estado("2026-10", { canales: [canalML({ cuentaId: "de-otro-negocio" })] });
  assert.equal(ajeno.canalesDescartados.length, 1);
  assert.equal(ajeno.consolidado.ingresos, null);
  assert.ok(ajeno.faltantes.some((f) => f.includes("mercado_libre: sin datos del mes")));
  assert.equal(ajeno.subtotalConocido.ingresos.valor, 160000);
  const sinConfig = estado("2026-10", { configurados: null, canales: [] });
  assert.equal(sinConfig.consolidado.ingresos, null);
  assert.equal(sinConfig.confianza, "baja");
  const incompleta = estado("2026-10", { canales: [canalML({ coberturaCompleta: false })] });
  const ml = incompleta.unidades.find((u) => u.tipo === "canal");
  assert.equal(ml.ingresos, null);
  assert.equal(ml.ingresosRegistrados, 20000);
});

test("aislamiento: gastos de una sucursal ajena se reportan, no se suman", () => {
  const e = estado("2026-10", { movimientos: [...movimientosDe("2026-10"), mov("z", "2026-10", "renta", 77777, { branch_id: "otra", expense_behavior: "fijo" })] });
  assert.ok(e.faltantes.some((f) => f.includes("no pertenecen al negocio")));
  assert.ok(!JSON.stringify(e.consolidado).includes("77777"));
});

test("efecto volumen y margen suman exactamente el cambio", () => {
  assert.deepEqual(efectoVolumenMargen({ ingresos: 100000, utilidadBruta: 45000 }, { ingresos: 90000, utilidadBruta: 36000 }), { volumen: -4500, margen: -4500, total: -9000 });
});

test("comparativo equivalente: solo unidades completas en ambos meses; aperturas fuera", () => {
  const oct = estado("2026-10");
  const { importaciones, filas } = cargasDelMes("2026-11", { s1: { venta: 90000, utilidad: 36000 }, s2: { venta: 60000, utilidad: 24000 }, s3: { venta: 5000, utilidad: 2000 } });
  importaciones.find((i) => i.branch_id === "s2").periodoFin = "2026-11-20";
  const nov = construirEstadoResultados({
    businessId: "monys", mes: "2026-11", sucursales: [...sucursales, { id: "s3", name: "Nueva", active: true }],
    sicar: elegirCargasPorDia(filas, importaciones), canales: [canalML()], canalesConfigurados: configML,
    movimientos: movimientosDe("2026-11", { nominaPlaza: 23000 }), obligaciones, bases: basesSinIva, isr: { tasaEstimadaPct: 30 }, hoy: "2026-12-15",
  });
  const dic = estado("2026-12");
  const comp = compararMeses([dic, nov, oct]);
  const m = comp.meses[1].vsMesAnterior;
  assert.deepEqual([...m.unidadesComparadas].sort(), ["canal:ml1", "s1"]);
  const motivos = Object.fromEntries(m.unidadesExcluidas.map((x) => [x.unidad, x.motivo]));
  assert.match(motivos.s2, /cobertura/);
  assert.match(motivos.s3, /apertura/);
  assert.deepEqual(m.ingresos, { delta: -10000, pct: -8.3 }); // 120 000 → 110 000, mismas unidades
  const centro = m.unidades.find((u) => u.unidad === "s1");
  assert.equal(centro.margenBrutoPp, -5);
  assert.equal(centro.ventaPromedioDiaria.delta, r(r(90000 / 30) - r(100000 / 31)));
  assert.equal(comp.meses[2].vsMesAnterior, null); // diciembre en curso
  assert.equal(compararMeses([oct, { ...nov, businessId: "flotilla" }]).calculable, false);
});

test("recomendaciones con impacto estimado, sin ejecutar nada", () => {
  const oct = estado("2026-10");
  const nov = estado("2026-11", { ventas: { s1: { venta: 90000, utilidad: 36000 }, s2: { venta: 60000, utilidad: 24000 } } });
  const { recomendaciones } = analizarRentabilidad([oct, nov]);
  const claves = recomendaciones.map((x) => x.clave);
  for (const clave of ["contribucion_negativa:s2", "margen_bruto:s1", "productos_con_perdida:canal:ml1", "cancelaciones:canal:ml1", "pendiente:s2", "conciliar_cargos_marketplace"]) {
    assert.ok(claves.includes(clave), clave);
  }
  assert.ok(recomendaciones.every((x) => x.requiereAutorizacion && x.tipo === "RECOMENDACION"));
  // Plaza: 24 000 − 15 000 nómina − 10 000 renta devengada = −1 000.
  assert.equal(recomendaciones.find((x) => x.clave === "contribucion_negativa:s2").impactoMensual, 1000);
  assert.equal(recomendaciones.find((x) => x.clave === "margen_bruto:s1").impactoMensual, 4500);
  const impactos = recomendaciones.map((x) => x.impactoMensual ?? -1);
  assert.deepEqual(impactos, [...impactos].sort((a, b) => b - a));
});

test("sin negocio o mes inválido no calcula", () => {
  assert.equal(construirEstadoResultados({ mes: "2026-10" }).calculable, false);
  assert.equal(construirEstadoResultados({ businessId: "x", mes: "2026-13" }).calculable, false);
});

test("calendario: fuera de vigencia no es faltante, cierre confirmado cuenta como cubierto y no quita gastos", () => {
  // Plaza abre el 16 de octubre; Centro cierra el 2 y su carga no trae el 2.
  const { importaciones, filas } = cargasDelMes("2026-10", { s1: { venta: 100000, utilidad: 45000 }, s2: { venta: 30000, utilidad: 12000 } });
  importaciones.find((i) => i.branch_id === "s2").periodoInicio = "2026-10-16";
  filas.find((f) => f.importacion_id === "s2-2026-10").fecha = "2026-10-20";
  const cal = calendarioDelNegocio({
    sucursales, mes: "2026-10",
    vigencias: [{ branch_id: "s1", operando_desde: "2020-01-01" }, { branch_id: "s2", operando_desde: "2026-10-16" }],
    dias: [{ branch_id: "s1", fecha: "2026-10-02", estado: "cerrado", motivo: "fumigación" }],
  });
  const e = construirEstadoResultados({
    businessId: "monys", mes: "2026-10", sucursales, sicar: elegirCargasPorDia(filas, importaciones), calendario: cal,
    canales: [canalML()], canalesConfigurados: configML, movimientos: movimientosDe("2026-10"), obligaciones, bases: basesSinIva, vinculosPlataforma: vinculosDe("2026-10"),
  });
  const plaza = e.unidades.find((u) => u.unidad === "s2");
  assert.equal(plaza.ingresos, 30000); // 16 días esperados, todos cubiertos
  assert.equal(plaza.cobertura.diasEsperados, 16);
  const centro = e.unidades.find((u) => u.unidad === "s1");
  assert.equal(centro.cobertura.cerrado, 1);
  assert.equal(centro.ventaPromedioDiaria, Math.round((100000 / 30) * 100) / 100); // 30 días abiertos
  assert.equal(centro.gastosDirectosPagado, 35000); // el cierre no quita gastos
  assert.ok(!e.provisional.some((p) => p.includes("Calendario operativo no disponible")));
  // Sucursal fuera de vigencia todo el mes: no opera y no es faltante.
  const calNov = calendarioDelNegocio({ sucursales, mes: "2026-11", vigencias: [{ branch_id: "s1", operando_desde: "2020-01-01" }, { branch_id: "s2", operando_desde: "2020-01-01", operando_hasta: "2026-10-31" }] });
  const { importaciones: i2, filas: f2 } = cargasDelMes("2026-11", { s1: { venta: 1000, utilidad: 400 } });
  const nov = construirEstadoResultados({ businessId: "monys", mes: "2026-11", sucursales, sicar: elegirCargasPorDia(f2, i2), calendario: calNov, canalesConfigurados: [], movimientos: [], bases: basesSinIva, vinculosPlataforma: [] });
  assert.deepEqual(nov.sucursalesQueNoOperan.map((x) => x.unidad), ["s2"]);
  assert.equal(nov.consolidado.ingresos, 1000);
});

test("una carga de SICAR filtrada no prueba venta cero", () => {
  const { importaciones, filas } = cargasDelMes("2026-10", { s1: { venta: 100, utilidad: 40 } });
  importaciones[0].alcance = "filtrado";
  const sicar = elegirCargasPorDia(filas, importaciones);
  const e = construirEstadoResultados({ businessId: "monys", mes: "2026-10", sucursales: [sucursales[0]], sicar, canalesConfigurados: [], movimientos: [], bases: basesSinIva, vinculosPlataforma: [] });
  assert.equal(e.unidades[0].ingresos, null);
  assert.equal(e.unidades[0].ingresosRegistrados, 100);
  assert.ok(e.faltantes.some((f) => f.includes("con filtros")));
});
