import test from "node:test";
import assert from "node:assert/strict";

import { debeAbrirFlotillaComoInicio } from "../../src/features/flotilla/utils/accesoFlotilla.js";

test("abre Flotilla directamente para una cuenta de consulta autorizada", () => {
  assert.equal(
    debeAbrirFlotillaComoInicio({
      role: "consulta",
      puedeVerLogistica: true,
    }),
    true,
  );
});

test("no cambia el inicio de otros roles ni de consultas sin permiso", () => {
  assert.equal(
    debeAbrirFlotillaComoInicio({
      role: "consulta",
      puedeVerLogistica: false,
    }),
    false,
  );
  assert.equal(
    debeAbrirFlotillaComoInicio({
      role: "owner",
      puedeVerLogistica: true,
    }),
    false,
  );
});
