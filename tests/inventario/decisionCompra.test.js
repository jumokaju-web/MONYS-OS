import test from "node:test";
import assert from "node:assert/strict";
import { construirDecisionCompra, priorizarProductosCompra } from "../../src/features/inventario/utils/decisionCompra.js";
import { construirResumenPlanCompra } from "../../src/features/inventario/utils/resumenPlanCompra.js";
import { calcularMargenComercial } from "../../src/features/inventario/utils/margenProducto.js";

const producto = (nombre, cobertura, ventaDiaria, precioCompra = 10, margenPorcentaje = 35) => ({
  llave: nombre,
  descripcion: nombre,
  compraTotal: 10,
  precioCompra,
  margenPorcentaje,
  inversionTotal: precioCompra * 10,
  sucursales: [{ sucursal: "Centro", coberturaActual: cobertura, ventaDiaria, cantidadComprar: 10 }],
});

const compra = (productos) => ({
  productos,
  inversionTotal: productos.reduce((total, item) => total + item.inversionTotal, 0),
  totalProductosRevisionInventario: 2,
  fuentes: [
    { sucursal: "Centro", inventarioDisponible: true, ventasDisponibles: true },
    { sucursal: "General Anaya", inventarioDisponible: true, ventasDisponibles: true },
  ],
  calidadDatos: { periodosVentasAlineados: true },
});

test("prioriza cobertura crítica y velocidad sin convertir datos pendientes en cero", () => {
  const lista = priorizarProductosCompra([
    producto("Cobertura media", 20, 8),
    producto("Crítico lento", 5, 1),
    producto("Crítico rápido", 5, 7),
    producto("Sin cobertura", null, 20),
  ]);
  assert.deepEqual(lista.map((item) => item.descripcion), ["Crítico rápido", "Crítico lento", "Cobertura media", "Sin cobertura"]);
  assert.equal(lista[0].prioridadCompra, "CRITICA");
  assert.equal(lista[0].margenPorcentaje, 35);
  assert.equal(lista.at(-1).coberturaMinima, null);
});

test("calcula margen comercial con costo y precio reales, y conserva faltantes", () => {
  assert.equal(calcularMargenComercial(60, 100), 40);
  assert.equal(calcularMargenComercial(0, 100), null);
  assert.equal(calcularMargenComercial(110, 100), null);
});

test("presupuesto desconocido queda pendiente y no se convierte en no autorizable", () => {
  const decision = construirDecisionCompra({ compraMaestra: compra([producto("A", 4, 3)]), capacidadCompra: null, disponibilidadConfirmada: false });
  assert.equal(decision.estado, "PENDIENTE_DATOS");
  assert.equal(decision.capacidadCompra, null);
  assert.equal(decision.faltanteParaAutorizar, null);
  assert.equal(decision.listoParaAutorizar, false);
  assert.match(decision.bloqueos[0], /Confirmar dinero disponible/);
});

test("solo queda lista con fuentes, costos y presupuesto confirmados", () => {
  const base = compra([producto("A", 4, 3)]);
  const lista = construirDecisionCompra({ compraMaestra: base, capacidadCompra: 500, disponibilidadConfirmada: true });
  assert.equal(lista.estado, "LISTA_PARA_AUTORIZACION");
  const excedida = construirDecisionCompra({ compraMaestra: base, capacidadCompra: 50, disponibilidadConfirmada: true });
  assert.equal(excedida.estado, "SUPERA_PRESUPUESTO");
  assert.equal(excedida.faltanteParaAutorizar, 50);
  const sinCosto = construirDecisionCompra({ compraMaestra: compra([producto("A", 4, 3, 0)]), capacidadCompra: 500, disponibilidadConfirmada: true });
  assert.equal(sinCosto.productosSinCosto, 1);
  assert.equal(sinCosto.listoParaAutorizar, false);
});

test("el historial guarda capacidad y faltante como pendientes cuando no existen", () => {
  const resumen = construirResumenPlanCompra({ compraMaestra: { inversionTotal: 1000 }, decisionFinanciera: { capacidadAutorizable: null } });
  assert.equal(resumen.version, "compra_maestra_v2");
  assert.equal(resumen.decisionFinanciera.estado, "PRESUPUESTO_PENDIENTE");
  assert.equal(resumen.decisionFinanciera.capacidadAutorizable, null);
  assert.equal(resumen.decisionFinanciera.faltanteParaAutorizar, null);
  assert.deepEqual(resumen.criteriosPriorizacion, ["cobertura", "velocidad", "margen", "costo", "presupuesto_confirmado"]);
});
