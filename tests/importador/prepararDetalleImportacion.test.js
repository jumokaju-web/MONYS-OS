import test from "node:test";
import assert from "node:assert/strict";
import { prepararDetalleImportacion } from "../../src/features/importador/utils/prepararDetalleImportacion.js";

test("omite cantidad ausente para que Supabase aplique el valor predeterminado y evite null", () => {
  const detalle = prepararDetalleImportacion({ proveedorNombre: "Pink Up", monto: 30000 }, 0, "carga-1");
  assert.equal(detalle.importacion_id, "carga-1");
  assert.equal(detalle.numero_fila, 1);
  assert.equal(Object.hasOwn(detalle, "cantidad"), false);
  assert.deepEqual(detalle.datos_originales, { proveedorNombre: "Pink Up", monto: 30000 });
});

test("conserva cantidades explícitas, incluido cero", () => {
  assert.equal(prepararDetalleImportacion({ cantidad: 3 }, 1, "carga-2").cantidad, 3);
  assert.equal(prepararDetalleImportacion({ cantidad: 0 }, 1, "carga-2").cantidad, 0);
});

test("omite cantidad vacía o nula en vez de enviarla como null", () => {
  for (const cantidad of [null, ""]) {
    assert.equal(Object.hasOwn(prepararDetalleImportacion({ cantidad }, 0, "carga-3"), "cantidad"), false);
  }
});
