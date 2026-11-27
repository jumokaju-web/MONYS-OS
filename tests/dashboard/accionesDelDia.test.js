import test from "node:test";
import assert from "node:assert/strict";
import {
  accionesDeDeudas,
  construirAccionesDelDia,
} from "../../src/core/impacto/accionesDelDia.js";
import {
  ESTADOS_IMPACTO,
  calcularImpactoCompra,
  calcularImpactoTraspaso,
} from "../../src/core/impacto/motorImpactoDinero.js";

const traspaso = (codigo, utilidad) => ({
  codigo,
  producto: `Producto ${codigo}`,
  cantidadSugerida: 10,
  branchOrigenId: "A",
  branchDestinoId: "B",
  sucursalOrigen: "Centro",
  sucursalDestino: "Nueva",
  impactoDinero: calcularImpactoTraspaso({ cantidad: 10, utilidadUnitaria: utilidad, costoUnitario: 50, ventaDiariaDestino: 1 }),
});

const compra = (llave, unidades, costo, precio) => ({
  llave,
  descripcion: `Compra ${llave}`,
  compraTotal: unidades,
  impactoDinero: calcularImpactoCompra({ unidades, costoUnitario: costo, precioVenta: precio, ventaDiariaEstimada: 2, diasTemporada: 30 }),
});

test("primero lo que se puede hacer sin gastar, luego lo que espera dinero", () => {
  const datos = construirAccionesDelDia({
    traspasos: [traspaso("T1", 30), traspaso("PIERDE", -5)],
    productosCompra: [compra("C1", 40, 50, 150), compra("C2", 10, 10, 20)],
    deudas: [
      { id: "d1", nombre: "Tarjeta", saldo_actual: 30000, tasa_anual: 60, estado: "ACTIVA" },
      { id: "d2", nombre: "Banco", saldo_actual: 80000, tasa_anual: 18, estado: "ACTIVA" },
      { id: "d3", nombre: "Proveedor", saldo_actual: 5000, tasa_anual: null, estado: "ACTIVA" },
    ],
  });

  const ids = datos.principales.map((accion) => accion.id);
  assert.equal(ids[0], "traspaso:T1:A:B");
  assert.deepEqual(ids.slice(1, 3), ["compra:C1", "deuda:d1"]);
  assert.ok(!ids.some((id) => id.includes("PIERDE")));
  assert.equal(datos.resumen.ganancia, 300);
  assert.equal(datos.resumen.accionesListas, 1);
  // compras C1 (4000) + C2 (100) + abono a la tarjeta (10,000 × 60% × 30/365)
  const interes = Math.round(10000 * 0.6 * (30 / 365) * 100) / 100;
  assert.equal(datos.resumen.gananciaPorConfirmarDinero, Math.round((4000 + 100 + interes) * 100) / 100);
  assert.equal(datos.totalAcciones, 5);
});

test("avalancha: abona primero a la tasa más alta y pide tasas faltantes", () => {
  const acciones = accionesDeDeudas([
    { id: "baja", nombre: "Banco", saldo_actual: 50000, tasa_anual: 20, estado: "ACTIVA" },
    { id: "alta", nombre: "Tarjeta", saldo_actual: 4000, tasa_anual: 70, estado: "REESTRUCTURADA" },
    { id: "cerrada", nombre: "Viejo", saldo_actual: 1000, tasa_anual: 99, estado: "LIQUIDADA" },
    { id: "x", nombre: "Proveedor", saldo_actual: 9000, tasa_anual: "", estado: "ACTIVA" },
  ]);
  assert.equal(acciones[0].id, "deuda:alta");
  assert.equal(acciones[0].impacto.estado, ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ);
  // El abono no puede ser mayor al saldo.
  assert.equal(acciones[0].impacto.ahorro, Math.round(4000 * 0.7 * (30 / 365) * 100) / 100);
  assert.equal(acciones[1].id, "deuda:sin-tasa");
  assert.equal(acciones[1].impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS);
});

test("sin datos no hay acciones ni totales inventados", () => {
  const datos = construirAccionesDelDia({});
  assert.equal(datos.totalAcciones, 0);
  assert.equal(datos.resumen.ganancia, 0);
  assert.equal(datos.resumen.gananciaPorConfirmarDinero, 0);
});
