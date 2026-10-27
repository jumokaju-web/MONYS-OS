import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENTO_IMPORTACIONES_ACTUALIZADAS,
  notificarImportacionesActualizadas,
} from "./importacionesActualizadas.js";

test("notifica a los paneles cuando termina una importación guardada", () => {
  const windowAnterior = globalThis.window;
  const eventos = [];
  globalThis.window = { dispatchEvent: (evento) => eventos.push(evento) };

  try {
    assert.equal(notificarImportacionesActualizadas(), true);
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].type, EVENTO_IMPORTACIONES_ACTUALIZADAS);
  } finally {
    if (windowAnterior === undefined) delete globalThis.window;
    else globalThis.window = windowAnterior;
  }
});

test("no intenta despachar eventos fuera del navegador", () => {
  const windowAnterior = globalThis.window;
  delete globalThis.window;

  try {
    assert.equal(notificarImportacionesActualizadas(), false);
  } finally {
    if (windowAnterior !== undefined) globalThis.window = windowAnterior;
  }
});
