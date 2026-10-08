import test from "node:test";
import assert from "node:assert/strict";
import { construirComparativoSucursales, compararRangosSucursales, consolidarFinanzasSucursales } from "../../src/features/inteligencia/shared/resumenSucursalesFinanciero.js";

test("calcula costo, utilidad bruta y margen con datos registrados", () => {
  const [centro] = construirComparativoSucursales([
    { nombre: "Centro", ventasTotales: 1800, utilidadTotal: 710 },
  ]);
  assert.equal(centro.costoMercancia, 1090);
  assert.equal(centro.utilidadBruta, 710);
  assert.ok(Math.abs(centro.margenBruto - (710 / 1800) * 100) < 0.01);
});

test("conserva ceros reales y deja faltantes sin convertirlos en cero", () => {
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

test("habilita líderes solo si los rangos detectados coinciden", () => {
  const sucursales = construirComparativoSucursales([
    { nombre: "Centro", ventasTotales: 1800, utilidadTotal: 710, periodo: { fechaInicial: "2026-09-22", fechaFinal: "2026-10-05" } },
    { nombre: "General Anaya", ventasTotales: 600, utilidadTotal: 230, periodo: { fechaInicio: "2026-09-22T10:00:00", fechaFin: "2026-10-05T20:00:00" } },
  ]);
  const comparacion = compararRangosSucursales(sucursales);
  assert.equal(comparacion.comparable, true);
  assert.equal(comparacion.estado, "MISMO_RANGO");
});

test("bloquea líderes cuando hay cortes distintos o fechas faltantes", () => {
  const distintos = construirComparativoSucursales([
    { nombre: "Centro", ventasTotales: 1000, utilidadTotal: 400, periodo: { fechaInicial: "2026-09-22", fechaFinal: "2026-10-05" } },
    { nombre: "General Anaya", ventasTotales: 500, utilidadTotal: 200, periodo: { fechaInicial: "2026-09-23", fechaFinal: "2026-10-05" } },
  ]);
  assert.equal(compararRangosSucursales(distintos).estado, "CORTES_DISTINTOS");
  assert.equal(compararRangosSucursales(distintos).comparable, false);

  const faltante = construirComparativoSucursales([
    { nombre: "Centro", ventasTotales: 1000, utilidadTotal: 400, periodo: { fechaInicial: "2026-09-22", fechaFinal: "2026-10-05" } },
    { nombre: "General Anaya", ventasTotales: 500, utilidadTotal: 200 },
  ]);
  assert.equal(compararRangosSucursales(faltante).estado, "FECHA_FALTANTE");
  assert.equal(compararRangosSucursales(faltante).comparable, false);
});

const fila = (venta, utilidad, inicio = "2026-09-28") => ({ ventasTotales: venta, utilidadTotal: utilidad, periodo: { fechaInicial: inicio, fechaFinal: "2026-10-04" } });
test("consolidación conserva cero y calcula siete días sin depender del dashboard activo", () => {
  const resultado = consolidarFinanzasSucursales([fila(1000, 400), fila(0, 0)]);
  assert.equal(resultado.disponible, true);
  assert.equal(resultado.ventas, 1000);
  assert.equal(resultado.costo, 600);
  assert.equal(resultado.diasAnalizados, 7);
});
test("consolidación bloquea cortes diferentes, importes faltantes e inconsistencias", () => {
  for (const filas of [[fila(1000, 400), fila(500, 200, "2026-09-29")], [fila(1000, 400), fila(null, null)], [fila(100, 120)]]) {
    assert.equal(consolidarFinanzasSucursales(filas).disponible, false);
  }
});
