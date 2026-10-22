import test from "node:test";
import assert from "node:assert/strict";
import { validarCierreTareaAtrasada } from "./higieneBacklogOperativo.js";

const tarea = {
  id: "tarea-1",
  estado: "en_proceso",
  fecha: "2026-10-20",
};
const evidencia = [{ id: "foto-1", tipo: "final", archivo_path: "tarea-1/final.jpg" }];

test("permite enviar una tarea iniciada vencida a revisión humana con evidencia y confirmación", () => {
  const resultado = validarCierreTareaAtrasada({
    tarea,
    hoy: "2026-10-22",
    evidencias: evidencia,
    confirmacion: "CERRAR TAREA",
  });

  assert.equal(resultado.valida, true);
  assert.equal(resultado.fechaOriginal, "2026-10-20");
  assert.deepEqual(resultado.evidenciasFinales, evidencia);
});

test("mantiene abierta la tarea si falta foto final o confirmación exacta", () => {
  assert.equal(validarCierreTareaAtrasada({ tarea, hoy: "2026-10-22", confirmacion: "CERRAR TAREA" }).valida, false);
  assert.equal(validarCierreTareaAtrasada({ tarea, hoy: "2026-10-22", evidencias: evidencia, confirmacion: "Cerrar tarea" }).valida, false);
});

test("no permite cerrar tareas que no están iniciadas o que ya no vencieron", () => {
  assert.equal(validarCierreTareaAtrasada({ tarea: { ...tarea, estado: "pendiente" }, hoy: "2026-10-22", evidencias: evidencia, confirmacion: "CERRAR TAREA" }).valida, false);
  assert.equal(validarCierreTareaAtrasada({ tarea, hoy: "2026-10-20", evidencias: evidencia, confirmacion: "CERRAR TAREA" }).valida, false);
});
