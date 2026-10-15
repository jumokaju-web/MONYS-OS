import test from "node:test";
import assert from "node:assert/strict";
import { construirCentroDireccionCEO } from "../../src/features/dashboard/utils/centroDireccionCEO.js";

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
      { estado: "ACTIVA", saldo_actual: 5000, pago_mensual: 500, tasa_anual: 20 },
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
  assert.equal(resumen.pagos.total7Dias, 2300);
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
