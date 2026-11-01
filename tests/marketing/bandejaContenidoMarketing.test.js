import assert from "node:assert/strict";
import test from "node:test";

import {
  clasificarPublicacionesContenido,
  validarComentarioDecision,
} from "../../src/features/inteligencia/utils/bandejaContenidoMarketing.js";

test("la bandeja separa revisión, trabajo e historial sin mezclar campañas", () => {
  const publicaciones = [
    { id: "1", estado: "PENDIENTE_APROBACION" },
    { id: "2", estado: "BORRADOR" },
    { id: "3", estado: "CANCELADA" },
  ];

  assert.deepEqual(clasificarPublicacionesContenido(publicaciones, "REVISION").map((item) => item.id), ["1"]);
  assert.deepEqual(clasificarPublicacionesContenido(publicaciones, "TRABAJO").map((item) => item.id), ["2"]);
  assert.deepEqual(clasificarPublicacionesContenido(publicaciones, "HISTORIAL").map((item) => item.id), ["3"]);
});

test("pedir ajustes y rechazar exigen una explicación útil", () => {
  assert.throws(() => validarComentarioDecision("AJUSTAR", "no"), /Explica brevemente/);
  assert.throws(() => validarComentarioDecision("RECHAZAR", ""), /Explica brevemente/);
  assert.equal(validarComentarioDecision("AJUSTAR", "  Cambiar la oferta  "), "Cambiar la oferta");
  assert.equal(validarComentarioDecision("APROBAR", ""), "");
});
