import test from "node:test";
import assert from "node:assert/strict";
import { normalizarVentasPorArticulo } from "../../src/features/importador/utils/normalizador.js";
import { generarResumenReporte } from "../../src/features/importador/utils/resumenReporte.js";
import { generarAnalisisEjecutivo } from "../../src/features/importador/intelligence/generarAnalisisEjecutivo.js";

test("un reporte SICAR de artículos con solo cantidades no convierte importes ausentes en $0", () => {
  const encabezados = Array(23).fill("");
  Object.assign(encabezados, {
    0: "Clave",
    2: "Descripción",
    10: "Departamento",
    16: "Categoría",
    22: "Cant",
  });
  const primera = Array(23).fill("");
  Object.assign(primera, {
    0: "M1189",
    2: "Mascarilla 10pz Surtida",
    10: "MASCARILLAS",
    16: "MASCARILLAS",
    22: 80,
  });
  const segunda = Array(23).fill("");
  Object.assign(segunda, {
    0: "M1670",
    2: "Rímel Prossa",
    10: "COSMÉTICOS",
    16: "COSMÉTICOS",
    22: 78,
  });

  const filas = normalizarVentasPorArticulo([encabezados, primera, segunda]);
  const resumen = generarResumenReporte(filas);
  const analisis = generarAnalisisEjecutivo(resumen);

  assert.equal(resumen.totalRegistros, 2);
  assert.equal(resumen.cantidadTotal, 158);
  assert.equal(resumen.ventaDisponible, false);
  assert.equal(resumen.utilidadDisponible, false);
  assert.equal(resumen.ventaTotal, null);
  assert.equal(resumen.utilidadTotal, null);
  assert.match(analisis.mensaje, /no incluye importes de venta ni costos ni utilidad/);
  assert.doesNotMatch(analisis.mensaje, /margen saludable|venta total fue de/);
});

test("los importes de una exportación que sí los trae siguen sumándose", () => {
  const filas = [
    { codigo: "A", descripcion: "Producto A", cantidad: 2, importe: 100, utilidad: 40 },
    { codigo: "B", descripcion: "Producto B", cantidad: 1, importe: 50, utilidad: 20 },
  ];
  const resumen = generarResumenReporte(filas);
  assert.equal(resumen.ventaDisponible, true);
  assert.equal(resumen.utilidadDisponible, true);
  assert.equal(resumen.ventaTotal, 150);
  assert.equal(resumen.utilidadTotal, 60);
});
