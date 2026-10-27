import test from "node:test";
import assert from "node:assert/strict";
import { crearControlSolicitudVigente } from "../../src/features/dashboard/utils/controlSolicitudVigente.js";

test("una respuesta tardía no conserva vigencia después de iniciar una consulta nueva", () => {
  const control = crearControlSolicitudVigente();
  const anterior = control.iniciar();
  const reciente = control.iniciar();

  assert.equal(control.esVigente(anterior), false);
  assert.equal(control.esVigente(reciente), true);
});

test("invalidar al desmontar o cambiar contexto bloquea la respuesta pendiente", () => {
  const control = crearControlSolicitudVigente();
  const pendiente = control.iniciar();

  control.invalidar();

  assert.equal(control.esVigente(pendiente), false);
});
