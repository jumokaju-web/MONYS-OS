import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizarVentasPorArticulo } from "../../src/features/importador/utils/normalizador.js";
import {
  esErrorColumnasDisponibilidad,
  leerBanderasVentaArticulo,
  prepararRegistroVentaArticulo,
} from "../../src/features/importador/utils/registroVentaArticulo.js";

const encabezados = ["Código", "Descripción", "Cantidad", "Importe", "Utilidad"];

test("la bandera se evalúa por celda: vacía es false, cero escrito es true", () => {
  const filas = normalizarVentasPorArticulo([
    encabezados,
    ["A1", "Labial", "2", "300", "0"],
    ["B2", "Rímel", "1", "", ""],
    ["C3", "Base", "1", "150", "60"],
  ]);
  const porCodigo = Object.fromEntries(filas.map((fila) => [fila.codigo, fila]));
  assert.equal(porCodigo.A1.utilidadDisponible, true);
  assert.equal(porCodigo.A1.utilidad, 0);
  assert.equal(porCodigo.B2.utilidadDisponible, false);
  assert.equal(porCodigo.B2.importeDisponible, false);
  assert.equal(porCodigo.B2.utilidad, 0);
  assert.equal(porCodigo.C3.importeDisponible, true);
});

test("sin columna de utilidad la bandera es false en todas las filas", () => {
  const filas = normalizarVentasPorArticulo([
    ["Código", "Descripción", "Cantidad", "Importe"],
    ["A1", "Labial", "2", "300"],
  ]);
  assert.equal(filas[0].utilidadDisponible, false);
  assert.equal(filas[0].importeDisponible, true);
});

test("el registro guarda las banderas y puede omitirlas sin migración", () => {
  const articulo = { codigo: "A1", descripcion: "Labial", cantidad: 2, importe: 300, utilidad: 0, utilidadDisponible: true, importeDisponible: true };
  const conBanderas = prepararRegistroVentaArticulo(articulo, "imp-1");
  assert.equal(conBanderas.utilidad_disponible, true);
  assert.equal(conBanderas.importe_disponible, true);
  assert.equal(conBanderas.importacion_id, "imp-1");

  const sinBanderas = prepararRegistroVentaArticulo(articulo, "imp-1", { conBanderas: false });
  assert.equal("utilidad_disponible" in sinBanderas, false);
  // Mismas columnas que guardaba el importador antes del cambio.
  assert.deepEqual(Object.keys(sinBanderas).sort(), [
    "cantidad", "categoria", "codigo", "costo", "descripcion", "descuento",
    "fecha", "folio_venta", "importacion_id", "importe", "sucursal", "utilidad",
  ]);
  // Una bandera ausente queda null (desconocido), no false.
  assert.equal(prepararRegistroVentaArticulo({ descripcion: "X" }, "imp-1").utilidad_disponible, null);
});

test("detecta el error de columnas faltantes y no confunde otros errores", () => {
  assert.equal(esErrorColumnasDisponibilidad({ code: "42703", message: 'column "utilidad_disponible" does not exist' }), true);
  assert.equal(esErrorColumnasDisponibilidad(new Error("Error al guardar ventas (lote 1 de 1): Could not find the 'importe_disponible' column of 'ventas_articulos' in the schema cache")), true);
  assert.equal(esErrorColumnasDisponibilidad({ message: "new row violates row-level security policy" }), false);
  assert.equal(esErrorColumnasDisponibilidad({ message: 'column "otra" does not exist' }), false);
});

test("la lectura convierte las banderas al formato del motor y conserva null", () => {
  assert.deepEqual(
    leerBanderasVentaArticulo({ codigo: "A1", utilidad_disponible: false, importe_disponible: true }),
    { codigo: "A1", utilidad_disponible: false, importe_disponible: true, utilidadDisponible: false, importeDisponible: true }
  );
  assert.equal(leerBanderasVentaArticulo({ codigo: "A1" }).utilidadDisponible, null);
});

test("la migración agrega las columnas sin rellenar datos históricos", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261128000000_banderas_disponibilidad_ventas_articulos.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists utilidad_disponible boolean null/);
  assert.match(sql, /add column if not exists importe_disponible boolean null/);
  assert.doesNotMatch(sql, /^\s*update\s/im);
  assert.doesNotMatch(sql, /drop\s+policy|disable row level security/i);
});
