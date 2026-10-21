import test from "node:test";
import assert from "node:assert/strict";
import { crearNombreCanalOperacion } from "../../src/features/flotilla/utils/realtimeFlotilla.js";

test("cada suscripción de Flotilla recibe un canal único aunque nazcan en el mismo milisegundo", () => {
  const primero = crearNombreCanalOperacion({ ahora: 1792546825377, aleatorio: "" });
  const segundo = crearNombreCanalOperacion({ ahora: 1792546825377, aleatorio: "" });

  assert.notEqual(primero, segundo);
  assert.match(primero, /^flotilla-operacion-en-vivo-1792546825377-/);
});
