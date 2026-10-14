import test from "node:test";
import assert from "node:assert/strict";

import {
  etiquetaTipoIncidencia,
  generarMensajeReporte,
  tipoIncidenciaRequierePaquete,
  validarArchivoIncidencia,
  validarNuevaIncidencia,
} from "../../src/features/flotilla/utils/incidenciasFlotilla.js";

test("exige ruta, código, descripción y dos fotografías", () => {
  const errores = validarNuevaIncidencia({ tipo: "OTRO", descripcion: "corto" });
  assert.equal(errores.length, 5);
  assert.match(errores.join(" "), /ruta/i);
  assert.match(errores.join(" "), /código/i);
  assert.match(errores.join(" "), /contexto/i);
  assert.match(errores.join(" "), /detalle/i);
});

test("los casos de paquete exigen ID y los de unidad no", () => {
  assert.equal(tipoIncidenciaRequierePaquete("PNR"), true);
  assert.equal(tipoIncidenciaRequierePaquete("DANO_UNIDAD"), false);

  const base = {
    rutaId: "ruta-1",
    codigoRuta: "B5",
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

test("retorno a CEDIS exige ID y persona que recibe", () => {
  const base = {
    rutaId: "ruta-1",
    codigoRuta: "B5",
    tipo: "RETORNO_CEDIS",
    descripcion: "",
    fotoContexto: {},
    fotoDetalle: {},
  };
  const errores = validarNuevaIncidencia(base).join(" ");
  assert.match(errores, /ID del paquete/);
  assert.match(errores, /quien recibe/i);

  assert.deepEqual(validarNuevaIncidencia({
    ...base,
    paqueteId: "PKG-9981",
    detalle: { recibeCedis: "Lorena" },
  }), []);
});

test("genera el mensaje exacto de retorno a CEDIS con ruta e ID", () => {
  assert.equal(generarMensajeReporte({
    codigoRuta: "B5",
    tipo: "RETORNO_CEDIS",
    paqueteId: "PKG-9981",
    detalle: { recibeCedis: "Lorena" },
  }), "Ruta B5 · Retorno a CEDIS · ID PKG-9981 · Recibe Lorena.");
});

test("genera el mensaje de alto valor con la persona que recibe", () => {
  assert.equal(generarMensajeReporte({
    codigoRuta: "D4",
    tipo: "ALTO_VALOR",
    paqueteId: "ABC-123",
    detalle: { parentescoRecibe: "hermana" },
  }), "Ruta D4 · Alto valor · Recibe hermana · ID ABC-123.");
});
