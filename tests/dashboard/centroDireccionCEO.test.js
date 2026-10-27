import test from "node:test";
import assert from "node:assert/strict";
import { construirCentroDireccionCEO, consolidarCreditosProveedores } from "../../src/features/dashboard/utils/centroDireccionCEO.js";

test("consolida proveedores solo con cortes vigentes para todas las sucursales", () => {
  const reporte = (fecha) => ({
    status: "fulfilled",
    value: { importacion: { created_at: `${fecha}T12:00:00Z` }, creditos: [{ saldo: 100 }] },
  });
  const vigente = consolidarCreditosProveedores([reporte("2026-10-20"), {
    status: "fulfilled",
    value: { disponible: true, fuente: "confirmacion_cero", confirmacion: { fecha_corte: "2026-10-27" }, creditos: [], saldoTotal: 0 },
  }], 2, "2026-10-27");
  assert.equal(vigente.fuenteCompleta, true);
  assert.equal(vigente.saldoTotal, 100);

  const viejo = consolidarCreditosProveedores([reporte("2026-09-20"), reporte("2026-10-20")], 2, "2026-10-27");
  assert.equal(viejo.disponible, true);
  assert.equal(viejo.fuenteCompleta, false);
});

test("un saldo negativo de proveedor no se resta del total identificado", () => {
  const consolidado = consolidarCreditosProveedores([{
    status: "fulfilled",
    value: {
      importacion: { created_at: "2026-10-27T12:00:00Z" },
      creditos: [{ saldo: 300 }, { saldo: -500 }],
    },
  }], 1, "2026-10-27");
  assert.equal(consolidado.saldosCompletos, false);
  assert.equal(consolidado.fuenteCompleta, false);
  assert.equal(consolidado.saldoTotal, 300);
});

test("no convierte fuentes faltantes en deuda o dinero de cero", () => {
  const resumen = construirCentroDireccionCEO({
    deudasConsultadas: false,
    creditosProveedores: { creditos: [], fuenteCompleta: false },
    compraConsultada: true,
    compraMaestra: { productos: [], fuentes: { productosVendidos: 0 } },
  });

  assert.equal(resumen.deuda.completa, false);
  assert.equal(resumen.dineroLibre, null);
  assert.equal(resumen.compra.estado, "datos");
  assert.match(resumen.compra.detalle, /Ventas por artículo/);
});

test("suma créditos y proveedores solo cuando las fuentes están completas", () => {
  const resumen = construirCentroDireccionCEO({
    deudasConsultadas: true,
    deudas: [
      { estado: "ACTIVA", saldo_actual: 5000, pago_mensual: 500, tasa_anual: 20, fecha_proximo_pago: "2026-10-22" },
      { estado: "LIQUIDADA", saldo_actual: 9000, pago_mensual: 900 },
    ],
    creditosProveedores: {
      fuenteCompleta: true,
      creditos: [{ nombre: "Proveedor A", saldo: 2300, fecha_vencimiento: "2026-10-18" }],
    },
    hoy: "2026-10-15",
  });

  assert.equal(resumen.deuda.completa, true);
  assert.equal(resumen.deuda.identificada, 7300);
  assert.equal(resumen.pagos.total7Dias, 2800);
});

test("un crédito activo sin saldo no cuenta como deuda cero ni calendario completo", () => {
  const resumen = construirCentroDireccionCEO({
    deudasConsultadas: true,
    deudas: [{ estado: "ACTIVA", saldo_actual: null, pago_mensual: 1200, fecha_proximo_pago: "2026-10-27" }],
    creditosProveedores: { fuenteCompleta: true, creditos: [] },
    hoy: "2026-10-27",
  });
  assert.equal(resumen.deuda.completa, false);
  assert.equal(resumen.deuda.identificada, 0);
  assert.equal(resumen.pagos.completo, false);
  assert.equal(resumen.pagos.total7Dias, null);
  assert.match(resumen.deuda.fuentesFaltantes.join(" "), /saldos actuales/);
});

test("un crédito sin próxima fecha de pago no entra como cero al calendario", () => {
  const resumen = construirCentroDireccionCEO({
    deudasConsultadas: true,
    deudas: [{ estado: "ACTIVA", saldo_actual: 5000, pago_mensual: 1200, fecha_proximo_pago: null }],
    creditosProveedores: { fuenteCompleta: true, creditos: [] },
    hoy: "2026-10-27",
  });
  assert.equal(resumen.deuda.completa, true);
  assert.equal(resumen.pagos.completo, false);
  assert.equal(resumen.pagos.total7Dias, null);
  assert.equal(resumen.pagos.fechasIncompletas, 1);
});

test("no muestra pagos de proveedores como calendario completo con fuentes vencidas", () => {
  const resumen = construirCentroDireccionCEO({
    deudasConsultadas: true,
    deudas: [{ estado: "ACTIVA", saldo_actual: 5000, pago_mensual: 500, fecha_proximo_pago: "2026-10-27" }],
    creditosProveedores: { fuenteCompleta: false, creditos: [{ nombre: "Proveedor viejo", saldo: 2000, fecha_vencimiento: "2026-10-27" }] },
    hoy: "2026-10-27",
  });
  assert.equal(resumen.deuda.completa, false);
  assert.equal(resumen.pagos.completo, false);
  assert.equal(resumen.pagos.total7Dias, null);
  assert.equal(resumen.pagos.lista.length, 1);
  assert.equal(resumen.pagos.lista[0].tipo, "Crédito");
});

test("bloquea una compra respaldada por demanda cuando el dinero libre no está confirmado", () => {
  const resumen = construirCentroDireccionCEO({
    compraConsultada: true,
    compraMaestra: {
      fuentes: { productosVendidos: 45 },
      totalPiezasComprar: 10,
      inversionTotal: 1500,
      productos: [{ llave: "codigo:1", descripcion: "Producto", compraTotal: 10 }],
    },
  });

  assert.equal(resumen.compra.estado, "bloqueado");
  assert.equal(resumen.compra.inversion, 1500);
});

test("recomienda pausar aumento solo con gasto y venta cero comprobados", () => {
  const resumen = construirCentroDireccionCEO({
    campanasConsultadas: true,
    campanas: [{
      id: "1",
      nombre: "Campaña sin retorno",
      estado: "ACTIVA",
      presupuesto: 500,
      resultado: {
        gastoAcumulado: 300,
        ventaAcumulada: 0,
        camposConfirmados: { gasto: true, venta: true },
      },
    }],
  });

  assert.equal(resumen.pausar.estado, "pausar");
  assert.equal(resumen.pausar.elementos[0].nombre, "Campaña sin retorno");
});

test("calcula una meta de crecimiento de 10 por ciento para la sucursal menor", () => {
  const resumen = construirCentroDireccionCEO({
    sucursales: [
      { nombre: "Centro", ventasTotales: 100000 },
      { nombre: "General Anaya", ventasTotales: 30000 },
    ],
  });

  assert.equal(resumen.crecimiento.sucursal, "General Anaya");
  assert.equal(resumen.crecimiento.meta10, 33000);
});
