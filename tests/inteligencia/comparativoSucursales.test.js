import test from "node:test";
import assert from "node:assert/strict";
import { construirComparativoSucursales } from "../../src/features/inteligencia/shared/resumenSucursalesFinanciero.js";

test("calcula costo, utilidad bruta y margen con datos registrados", () => {
  const [centro] = construirComparativoSucursales([
    { nombre: "Centro", ventasTotales: 1800, utilidadTotal: 710 },
  ]);
  assert.equal(centro.costoMercancia, 1090);
  assert.equal(centro.utilidadBruta, 710);
  assert.ok(Math.abs(centro.margenBruto - (710 / 1800) * 100) < 0.01);
});

test("conserva ceros reales y no convierte datos faltantes en cero", () => {
  const resultado = construirComparativoSucursales([
    { nombre: "Centro", ventasTotales: 0, utilidadTotal: 0 },
    { nombre: "General Anaya", ventasTotales: null, utilidadTotal: undefined },
  ]);
  assert.equal(resultado[0].ventas, 0);
  assert.equal(resultado[0].utilidadBruta, 0);
  assert.equal(resultado[0].margenBruto, null);
  assert.equal(resultado[1].ventas, null);
  assert.equal(resultado[1].costoMercancia, null);
  assert.equal(resultado[1].margenBruto, null);
});

test("marca inconsistencias en vez de ocultarlas", () => {
  const [resultado] = construirComparativoSucursales([
    { nombre: "Sucursal", ventasTotales: 100, utilidadTotal: 120 },
  ]);
  assert.equal(resultado.costoMercancia, -20);
  assert.equal(resultado.costoInconsistente, true);
});
