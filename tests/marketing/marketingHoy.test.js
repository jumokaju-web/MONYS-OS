import assert from "node:assert/strict";
import test from "node:test";

import { resumirMarketingHoy } from "../../src/features/inteligencia/utils/marketingHoy.js";

test("prioriza aprobación antes de publicación y medición", () => {
  const resumen = resumirMarketingHoy({
    fecha: new Date(2026, 10, 2),
    publicaciones: [
      { id: "aprobar", estado: "PENDIENTE_APROBACION" },
      { id: "publicar", estado: "PROGRAMADA", programada_para: "2026-11-02T12:00:00" },
      { id: "medir", estado: "PUBLICADA", publicada_en: "2026-11-01T12:00:00" },
    ],
  });
  assert.equal(resumen.prioridad.tipo, "REVISAR");
  assert.equal(resumen.programadasHoy.length, 1);
  assert.equal(resumen.resultadosPendientes.length, 1);
});

test("una publicación con resultado deja de aparecer pendiente de medición", () => {
  const resumen = resumirMarketingHoy({
    publicaciones: [{ id: "publicada", estado: "PUBLICADA", publicada_en: "2026-11-02T12:00:00" }],
    resultados: [{ publicacion_id: "publicada" }],
    fecha: new Date(2026, 10, 2),
  });
  assert.equal(resumen.resultadosPendientes.length, 0);
});
