import assert from "node:assert/strict";
import test from "node:test";

import { debeAbrirFlotillaComoInicio } from "./accesoFlotilla.js";

test("el rol chofer abre su operación de Flotilla como inicio", () => {
  assert.equal(
    debeAbrirFlotillaComoInicio({ role: "chofer", puedeVerLogistica: true }),
    true,
  );
});

test("conserva el acceso heredado de consulta y normaliza el rol", () => {
  assert.equal(
    debeAbrirFlotillaComoInicio({ role: " Consulta ", puedeVerLogistica: true }),
    true,
  );
});

test("no abre Flotilla sin permiso ni para perfiles de Dirección", () => {
  assert.equal(
    debeAbrirFlotillaComoInicio({ role: "chofer", puedeVerLogistica: false }),
    false,
  );
  assert.equal(
    debeAbrirFlotillaComoInicio({ role: "admin", puedeVerLogistica: true }),
    false,
  );
});
