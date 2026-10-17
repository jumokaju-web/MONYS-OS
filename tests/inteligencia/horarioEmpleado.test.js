import test from "node:test";
import assert from "node:assert/strict";

import { resolverHorarioEmpleado } from "../../src/features/inteligencia/shared/horarioEmpleado.js";

const empleado = { id: "karla", usuario_id: "auth-karla", branch_id: "centro" };
const perfil = { empleado_id: "karla", branch_id: "centro", dia_descanso: 2, turno_asignado: "SEGUNDO" };

test("la entrada real manda aunque el horario base diga descanso", () => {
  const resultado = resolverHorarioEmpleado({
    fecha: "2026-10-20",
    empleado,
    perfil,
    asistenciaRegistrada: [{ empleado_id: "karla", branch_id: "centro", entrada_at: "2026-10-20T21:00:00Z" }],
  });
  assert.equal(resultado.estado, "PRESENTE");
  assert.equal(resultado.disponible, true);
  assert.equal(resultado.fuente, "ASISTENCIA_REAL");
});

test("una excepción por fecha sustituye el horario semanal", () => {
  const resultado = resolverHorarioEmpleado({
    fecha: "2026-10-18",
    empleado,
    perfil,
    horarios: [{ empleado_id: "karla", dia_semana: 0, estado: "TRABAJA", hora_inicio: "10:00", hora_fin: "16:00", branch_id: "centro" }],
    excepciones: [{ empleado_id: "karla", fecha: "2026-10-18", estado: "TRABAJA", hora_inicio: "10:00", hora_fin: "14:00", branch_id: "general" }],
  });
  assert.equal(resultado.estado, "PROGRAMADA");
  assert.equal(resultado.branchId, "general");
  assert.equal(resultado.horaFin, "14:00");
  assert.equal(resultado.fuente, "EXCEPCION");
});

test("un horario flexible no se convierte en presencia ni incumplimiento", () => {
  const resultado = resolverHorarioEmpleado({
    fecha: "2026-10-19",
    empleado: { ...empleado, id: "kary" },
    perfil: { ...perfil, empleado_id: "kary", turno_asignado: "AMBOS" },
    horarios: [{ empleado_id: "kary", dia_semana: 1, estado: "FLEXIBLE", branch_id: "centro" }],
  });
  assert.equal(resultado.estado, "HORARIO_FLEXIBLE");
  assert.equal(resultado.disponible, false);
  assert.equal(resultado.flexible, true);
});

test("conserva el perfil antiguo como respaldo cuando no existe calendario", () => {
  const trabaja = resolverHorarioEmpleado({ fecha: "2026-10-19", empleado, perfil });
  const descansa = resolverHorarioEmpleado({ fecha: "2026-10-20", empleado, perfil });
  assert.equal(trabaja.estado, "PROGRAMADA");
  assert.equal(trabaja.turno, "SEGUNDO");
  assert.equal(descansa.estado, "DESCANSA");
});
