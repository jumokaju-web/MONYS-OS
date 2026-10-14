import test from "node:test";
import assert from "node:assert/strict";

import {
  etiquetaTipoIncidencia,
  tipoIncidenciaRequierePaquete,
  validarArchivoIncidencia,
  validarNuevaIncidencia,
} from "../../src/features/flotilla/utils/incidenciasFlotilla.js";

test("exige ruta, descripción y dos fotografías", () => {
  const errores = validarNuevaIncidencia({ tipo: "OTRO", descripcion: "corto" });
  assert.equal(errores.length, 4);
  assert.match(errores.join(" "), /ruta/i);
  assert.match(errores.join(" "), /general/i);
  assert.match(errores.join(" "), /cercana/i);
});

test("los casos de paquete exigen ID y los de unidad no", () => {
  assert.equal(tipoIncidenciaRequierePaquete("PNR"), true);
  assert.equal(tipoIncidenciaRequierePaquete("DANO_UNIDAD"), false);

  const base = {
    rutaId: "ruta-1",
    descripcion: "Descripción suficiente",
    fotoContexto: {},
    fotoDetalle: {},
  };
  assert.match(validarNuevaIncidencia({ ...base, tipo: "PNR" }).join(" "), /ID del paquete/);
  assert.deepEqual(validarNuevaIncidencia({ ...base, tipo: "DANO_UNIDAD" }), []);
});

test("limita formato y tamaño de fotografías", () => {
  assert.equal(validarArchivoIncidencia({ type: "image/jpeg", size: 1024 }), "");
  assert.match(validarArchivoIncidencia({ type: "image/heic", size: 1024 }), /JPG/);
  assert.match(validarArchivoIncidencia({ type: "image/png", size: 11 * 1024 * 1024 }), /10 MB/);
  assert.equal(etiquetaTipoIncidencia("ACCIDENTE"), "Accidente");
});
