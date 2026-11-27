import test from "node:test";
import assert from "node:assert/strict";
import {
  ESTADOS_IMPACTO,
  calcularImpactoCampana,
  calcularImpactoCompra,
  calcularImpactoPagoDeuda,
  calcularImpactoTraspaso,
  priorizarAcciones,
  resumirImpacto,
  resumirMargenesPorProducto,
} from "../../src/core/impacto/motorImpactoDinero.js";

test("resume margen por producto con totales de SICAR", () => {
  const margenes = resumirMargenesPorProducto([
    { codigo: "0012", cantidad: 2, importe: 400, utilidad: 160 },
    { codigo: "0012 ", cantidad: 3, importe: 600, utilidad: 240 },
    { codigo: "", cantidad: 5, importe: 100, utilidad: 50 },
  ]);
  const producto = margenes.get("codigo:0012");
  assert.equal(producto.piezas, 5);
  assert.equal(producto.precioPromedio, 200);
  assert.equal(producto.utilidadUnitaria, 80);
  assert.equal(producto.costoUnitario, 120);
  assert.equal(producto.margen, 0.4);
  assert.equal(margenes.size, 1);
});

test("utilidad en cero con importe no se toma como margen real", () => {
  const margenes = resumirMargenesPorProducto([{ codigo: "A", cantidad: 4, importe: 400, utilidad: 0 }]);
  assert.equal(margenes.get("codigo:a").utilidadUnitaria, null);
  assert.equal(margenes.get("codigo:a").precioPromedio, 100);
});

test("traspaso: gana solo lo que el destino alcanza a vender y separa el ahorro", () => {
  const impacto = calcularImpactoTraspaso({
    cantidad: 10,
    utilidadUnitaria: 80,
    costoUnitario: 120,
    ventaDiariaDestino: 0.5,
    diasHorizonte: 14,
    costoTraslado: 60,
  });
  assert.equal(impacto.estado, ESTADOS_IMPACTO.ESTIMADO);
  assert.equal(impacto.piezasVendibles, 7);
  assert.equal(impacto.ganancia, 7 * 80 - 60);
  assert.equal(impacto.ahorro, 1200);
});

test("traspaso sin utilidad no inventa ceros", () => {
  const impacto = calcularImpactoTraspaso({ cantidad: 5, ventaDiariaDestino: 1 });
  assert.equal(impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS);
  assert.equal(impacto.ganancia, null);
  assert.ok(impacto.faltantes.some((faltante) => faltante.includes("utilidad")));
});

test("traspaso que no paga su traslado no conviene", () => {
  const impacto = calcularImpactoTraspaso({
    cantidad: 2, utilidadUnitaria: 20, ventaDiariaDestino: 1, costoTraslado: 100,
  });
  assert.equal(impacto.estado, ESTADOS_IMPACTO.NO_CONVIENE);
  assert.equal(impacto.ganancia, -60);
});

test("compra de temporada descuenta la pérdida de lo que sobra", () => {
  const impacto = calcularImpactoCompra({
    unidades: 100,
    costoUnitario: 50,
    precioVenta: 120,
    ventaDiariaEstimada: 2,
    diasTemporada: 30,
    capitalDisponible: 10000,
  });
  // 60 vendidas × 70 − 40 sobrantes × (50 − 25)
  assert.equal(impacto.ganancia, 60 * 70 - 40 * 25);
  assert.equal(impacto.inversion, 5000);
  assert.equal(impacto.unidadesRecomendadas, 60);
  assert.equal(impacto.estado, ESTADOS_IMPACTO.ESTIMADO);
});

test("compra sin liquidez confirmada queda pendiente, no autorizada", () => {
  const sinDato = calcularImpactoCompra({
    unidades: 10, costoUnitario: 50, precioVenta: 120, ventaDiariaEstimada: 1, diasTemporada: 30,
  });
  assert.equal(sinDato.estado, ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ);
  const insuficiente = calcularImpactoCompra({
    unidades: 10, costoUnitario: 50, precioVenta: 120, ventaDiariaEstimada: 1, diasTemporada: 30, capitalDisponible: 100,
  });
  assert.equal(insuficiente.estado, ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ);
});

test("campaña calcula utilidad y ROAS de equilibrio", () => {
  const impacto = calcularImpactoCampana({ presupuesto: 1000, margenBruto: 0.4, ventasConCampana: 9000, ventasSinCampana: 5000 });
  assert.equal(impacto.ganancia, 4000 * 0.4 - 1000);
  assert.equal(impacto.roasEquilibrio, 2.5);
  assert.equal(impacto.roasEstimado, 4);
  const mala = calcularImpactoCampana({ presupuesto: 1000, margenBruto: 0.4, ventasAdicionalesEstimadas: 2000 });
  assert.equal(mala.estado, ESTADOS_IMPACTO.NO_CONVIENE);
});

test("pago anticipado de deuda calcula interés ahorrado", () => {
  const impacto = calcularImpactoPagoDeuda({ saldo: 50000, monto: 20000, tasaAnual: 0.6, diasAnticipo: 30, cargoEvitado: 350 });
  assert.equal(impacto.ahorro, Math.round((20000 * 0.6 * 30 / 365 + 350) * 100) / 100);
});

test("prioriza por estado y dinero, y el resumen no mezcla pendientes", () => {
  const acciones = [
    { id: "a", impacto: calcularImpactoTraspaso({ cantidad: 5, ventaDiariaDestino: 1 }) },
    { id: "b", impacto: calcularImpactoTraspaso({ cantidad: 5, utilidadUnitaria: 50, costoUnitario: 100, ventaDiariaDestino: 1 }) },
    { id: "c", impacto: calcularImpactoTraspaso({ cantidad: 5, utilidadUnitaria: 90, costoUnitario: 100, ventaDiariaDestino: 1 }) },
    { id: "d", impacto: calcularImpactoPagoDeuda({ saldo: 1000, monto: 1000, tasaAnual: 0.365, diasAnticipo: 10 }) },
  ];
  assert.deepEqual(priorizarAcciones(acciones).map((accion) => accion.id), ["c", "b", "d", "a"]);
  const resumen = resumirImpacto(acciones);
  assert.equal(resumen.ganancia, 450 + 250 + 10);
  assert.equal(resumen.ahorro, 1000);
  assert.equal(resumen.accionesListas, 3);
  assert.equal(resumen.accionesPendientes, 1);
});
