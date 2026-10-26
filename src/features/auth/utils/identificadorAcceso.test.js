import test from "node:test";
import assert from "node:assert/strict";

import {
  correoInternoParaTelefono,
  normalizarTelefonoAcceso,
  prepararInicioSesion,
} from "./identificadorAcceso.js";

test("normaliza teléfonos mexicanos de diez dígitos", () => {
  assert.equal(normalizarTelefonoAcceso("378 142 2357"), "3781422357");
  assert.equal(normalizarTelefonoAcceso("+52 378 142 2357"), "3781422357");
  assert.equal(normalizarTelefonoAcceso("+52 1 378 142 2357"), "3781422357");
});

test("rechaza teléfonos incompletos", () => {
  assert.equal(normalizarTelefonoAcceso("378142"), null);
  assert.equal(correoInternoParaTelefono("378142"), null);
});

test("mantiene el correo y convierte el teléfono en identificador interno", () => {
  assert.deepEqual(prepararInicioSesion(" MONICA@EJEMPLO.COM "), {
    email: "monica@ejemplo.com",
  });
  assert.deepEqual(prepararInicioSesion("3781422357"), {
    email: "telefono.3781422357@acceso.telefono.monys.local",
  });
});
