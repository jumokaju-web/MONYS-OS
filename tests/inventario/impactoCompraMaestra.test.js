import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularImpactoProductoCompra,
  evaluarImpactoCompras,
} from "../../src/features/inventario/utils/impactoCompraMaestra.js";
import { ESTADOS_IMPACTO } from "../../src/core/impacto/motorImpactoDinero.js";

function producto(llave, { compraTotal, precioCompra, precioVenta, ventaDiaria, existencia = 0, traspaso = 0, revision = false }) {
  return {
    llave,
    codigo: llave,
    descripcion: `Producto ${llave}`,
    compraTotal,
    precioCompra,
    precioVenta,
    sucursales: [
      { ventaDiaria, existenciaActual: existencia, cubiertoPorTraspaso: traspaso, requiereRevisionInventario: revision },
    ],
  };
}

test("la compra solo cuenta la demanda que no cubren existencia y traspasos", () => {
  // Demanda 30 días: 60; existencia 10 y traspaso 10 → mercancía nueva vende 40.
  const impacto = calcularImpactoProductoCompra(
    producto("A", { compraTotal: 50, precioCompra: 40, precioVenta: 100, ventaDiaria: 2, existencia: 10, traspaso: 10 })
  );
  assert.equal(impacto.unidadesRecomendadas, 40);
  assert.equal(impacto.ganancia, 40 * 60 - 10 * 20);
  assert.equal(impacto.estado, ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ);
});

test("precio en cero se trata como dato faltante", () => {
  const impacto = calcularImpactoProductoCompra(
    producto("B", { compraTotal: 5, precioCompra: 40, precioVenta: 0, ventaDiaria: 1 })
  );
  assert.equal(impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS);
});

test("con dinero confirmado prioriza el mejor retorno hasta donde alcanza", () => {
  const productos = [
    producto("BAJO", { compraTotal: 30, precioCompra: 100, precioVenta: 130, ventaDiaria: 1 }),
    producto("ALTO", { compraTotal: 30, precioCompra: 50, precioVenta: 150, ventaDiaria: 1 }),
    producto("SIN", { compraTotal: 5, precioCompra: 0, precioVenta: 0, ventaDiaria: 1 }),
  ];
  const { resumen, mejores, productos: evaluados } = evaluarImpactoCompras(productos, { capitalDisponible: 2000 });
  assert.equal(evaluados.length, 3);
  assert.deepEqual(mejores.map((item) => item.llave), ["ALTO", "BAJO"]);
  assert.equal(resumen.gananciaEstimada, 30 * 100 + 30 * 30);
  assert.equal(resumen.inversion, 1500 + 3000);
  assert.equal(resumen.productosConCapital, 1);
  assert.equal(resumen.inversionConCapital, 1500);
  assert.equal(resumen.gananciaConCapital, 3000);
  assert.equal(resumen.productosSinDatos, 1);
});

test("sin dinero confirmado no calcula hasta dónde alcanza", () => {
  const { resumen } = evaluarImpactoCompras([
    producto("A", { compraTotal: 10, precioCompra: 10, precioVenta: 20, ventaDiaria: 1 }),
  ]);
  assert.equal(resumen.capitalDisponible, null);
  assert.equal(resumen.gananciaConCapital, null);
});
