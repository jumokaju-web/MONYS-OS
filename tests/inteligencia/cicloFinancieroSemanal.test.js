import test from "node:test";
import assert from "node:assert/strict";
import { validarCicloLunesDomingo } from "../../src/features/inteligencia/utils/cicloFinancieroSemanal.js";

test("acepta el ciclo completo del lunes 19 al domingo 25 de octubre de 2026", () => {
  assert.deepEqual(validarCicloLunesDomingo("2026-10-19", "2026-10-25"), {
    valido: true,
    dias: 7,
    motivo: "Semana completa de lunes a domingo.",
  });
  assert.equal(
    validarCicloLunesDomingo(new Date("2026-10-19T19:00:00.000Z"), new Date("2026-10-25T19:00:00.000Z")).valido,
    true,
  );
});

test("rechaza cortes que empiezan o terminan en un día distinto", () => {
  assert.equal(validarCicloLunesDomingo("2026-10-20", "2026-10-26").valido, false);
  assert.equal(validarCicloLunesDomingo("2026-10-19", "2026-10-24").valido, false);
});

test("rechaza periodos largos, fechas imposibles y rangos invertidos", () => {
  assert.equal(validarCicloLunesDomingo("2026-10-19", "2026-11-01").valido, false);
  assert.equal(validarCicloLunesDomingo("2026-02-30", "2026-03-01").valido, false);
  assert.equal(validarCicloLunesDomingo("2026-10-26", "2026-10-25").valido, false);
});
