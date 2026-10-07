import test from "node:test";
import assert from "node:assert/strict";
import { construirActualizacionCRMDesdeSeguimiento } from "../../src/features/inteligencia/shared/actualizacionCRM.js";

test("un seguimiento completado actualiza etapa, resultado y limpia la fecha vencida", () => {
  assert.deepEqual(
    construirActualizacionCRMDesdeSeguimiento("Habló; envié cotización", "2026-10-06T21:00:00.000Z"),
    {
      etapa: "CONTACTADO",
      proximo_seguimiento: null,
      ultimo_resultado: "Habló; envié cotización",
      ultimo_seguimiento_at: "2026-10-06T21:00:00.000Z",
      updated_at: "2026-10-06T21:00:00.000Z",
    },
  );
});

test("el resultado del contacto no puede quedar vacío", () => {
  assert.throws(
    () => construirActualizacionCRMDesdeSeguimiento("  ", "2026-10-06T21:00:00.000Z"),
    /obligatorio/,
  );
});
