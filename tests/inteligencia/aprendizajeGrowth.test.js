import test from "node:test";
import assert from "node:assert/strict";
import { hayAprendizajeGrowth } from "../../src/features/inteligencia/shared/aprendizajeGrowth.js";

test("no marca aprendizaje como completo por cerrar una campaña vacía", () => {
  assert.equal(
    hayAprendizajeGrowth({
      aprendizaje: {},
      campanasFinalizadas: [{ estado: "FINALIZADA", aprendizaje: {} }],
    }),
    false,
  );
});

test("ignora metadatos de estado sin una conclusión escrita", () => {
  assert.equal(
    hayAprendizajeGrowth({
      campanasFinalizadas: [{ aprendizaje: { estado: "PROVISIONAL", confianza: 70 } }],
    }),
    false,
  );
});

test("reconoce el resumen guardado en una campaña finalizada", () => {
  assert.equal(
    hayAprendizajeGrowth({
      campanasFinalizadas: [{ aprendizaje: { resumenIA: "El video generó pedidos orgánicos." } }],
    }),
    true,
  );
});

test("reconoce la siguiente acción registrada en la campaña actual", () => {
  assert.equal(
    hayAprendizajeGrowth({
      aprendizaje: { recomendacionFutura: "Repetir el contenido y medir pedidos." },
    }),
    true,
  );
});

test("no cuenta mensajes provisionales como aprendizaje registrado", () => {
  assert.equal(
    hayAprendizajeGrowth({
      aprendizaje: {
        resumenIA: "Pendiente",
        decisionFutura: "REQUIERE_MAS_DATOS",
        recomendacionFutura: "Por confirmar",
      },
    }),
    false,
  );
});
