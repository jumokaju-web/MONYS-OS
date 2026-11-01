import assert from "node:assert/strict";
import test from "node:test";

import { resumirProgresoTurno, saludoTurno } from "./progresoTurnoEmpleado.js";

test("el progreso distingue entrada, tareas abiertas y terminadas", () => {
  const progreso = resumirProgresoTurno({
    entradaRegistrada: true,
    tareasCargando: false,
    pendientes: 1,
    enProceso: 1,
    terminadas: 2,
  });

  assert.equal(progreso.accionesCompletas, 3);
  assert.equal(progreso.totalAcciones, 5);
  assert.equal(progreso.porcentaje, 60);
});

test("una jornada sin tareas queda completa al registrar entrada", () => {
  const progreso = resumirProgresoTurno({
    entradaRegistrada: true,
    tareasCargando: false,
  });

  assert.equal(progreso.porcentaje, 100);
  assert.match(progreso.mensaje, /Excelente/);
});

test("el saludo cambia sin depender del nombre de la empleada", () => {
  assert.equal(saludoTurno(9), "Buenos días");
  assert.equal(saludoTurno(15), "Buenas tardes");
  assert.equal(saludoTurno(21), "Buenas noches");
});
