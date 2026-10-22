import test from "node:test";
import assert from "node:assert/strict";
import { construirControlDiarioSucursal } from "../../src/features/inteligencia/shared/controlDiarioSucursal.js";

const fecha = "2026-10-14";

test("prioriza accesos y perfiles faltantes antes de aparentar una operación lista", () => {
  const empleados = [
    { id: "1", nombre: "Ana", active: true, auth_user_id: null },
    { id: "2", nombre: "Karla", active: true, auth_user_id: "u2" },
  ];
  const control = construirControlDiarioSucursal({ fecha, empleados });
  assert.equal(control.metricas.sinAcceso, 1);
  assert.equal(control.metricas.sinPerfil, 1);
  assert.match(control.prioridad.titulo, /Vincula 1 acceso/);
});

test("separa descanso, entrada y avance real de tareas", () => {
  const empleados = [
    { id: "1", nombre: "Ana", puesto: "Marketing", active: true, auth_user_id: "u1" },
    { id: "2", nombre: "Karla", puesto: "Vendedora", active: true, auth_user_id: "u2" },
  ];
  const configuraciones = [
    { empleado_id: "1", nombre_preferido: "Ana", dia_descanso: 3 },
    { empleado_id: "2", nombre_preferido: "Karla", dia_descanso: 0 },
  ];
  const asistencias = [{ empleado_id: "2", entrada_at: "2026-10-14T15:00:00Z" }];
  const tareas = [
    { id: "t1", responsable: "Karla", estado: "terminada" },
    { id: "t2", responsable_usuario_id: "u2", estado: "en_proceso" },
  ];
  const control = construirControlDiarioSucursal({ fecha, empleados, configuraciones, asistencias, tareas });
  assert.equal(control.metricas.descansan, 1);
  assert.equal(control.metricas.presentes, 1);
  assert.equal(control.metricas.tareasAbiertas, 1);
  const karla = control.personas.find((persona) => persona.nombre === "Karla");
  assert.equal(karla.tareas, 2);
  assert.equal(karla.terminadas, 1);
  assert.equal(karla.enProceso, 1);
});

test("no presenta operación al día cuando hay personal presente sin reparto", () => {
  const empleados = [{ id: "1", nombre: "Karla", active: true, auth_user_id: "u1" }];
  const configuraciones = [{ empleado_id: "1", dia_descanso: 0 }];
  const asistencias = [{ empleado_id: "1", entrada_at: "2026-10-14T15:00:00Z" }];
  const control = construirControlDiarioSucursal({ fecha, empleados, configuraciones, asistencias, tareas: [] });
  assert.equal(control.prioridad.titulo, "Prepara el reparto del día");
});

test("cuenta una entrada real aunque el perfil operativo siga pendiente", () => {
  const empleados = [{ id: "1", nombre: "Kary", active: true, auth_user_id: "u1" }];
  const asistencias = [{ empleado_id: "1", entrada_at: "2026-10-14T16:36:00Z" }];
  const control = construirControlDiarioSucursal({ fecha, empleados, asistencias });

  assert.equal(control.metricas.presentes, 1);
  assert.equal(control.metricas.sinPerfil, 1);
  assert.equal(control.personas[0].presente, true);
  assert.equal(control.personas[0].estado, "SIN_PERFIL");
});

test("horario diario prevalece sobre descanso base y no marca falta antes del final", () => {
  const base = { fecha, empleados: [{ id: "1", auth_user_id: "u1" }],
    configuraciones: [{ empleado_id: "1", dia_descanso: 3 }],
    excepciones: [{ empleado_id: "1", fecha, estado: "TRABAJA", hora_inicio: "14:00:00", hora_fin: "20:00:00" }] };
  const antes = construirControlDiarioSucursal({ ...base, ahora: new Date("2026-10-14T19:00:00-06:00") });
  assert.equal(antes.personas[0].estado, "PROGRAMADA");
  assert.equal(antes.personas[0].horarioPrevisto, "14:00 a 20:00");
  const despues = construirControlDiarioSucursal({ ...base, ahora: new Date("2026-10-14T20:01:00-06:00") });
  assert.equal(despues.personas[0].estado, "FALTA_POR_CONFIRMAR");
  const presente = construirControlDiarioSucursal({ ...base, ahora: new Date("2026-10-14T22:00:00-06:00"),
    asistencias: [{ empleado_id: "1", entrada_at: "2026-10-14T20:00:00Z", salida_at: "2026-10-15T02:00:00Z" }] });
  assert.equal(presente.personas[0].estado, "PRESENTE");
  assert.equal(presente.personas[0].salidaAt, "2026-10-15T02:00:00Z");
});

test("descanso autodeclarado no se convierte en falta y una entrada real prevalece", () => {
  const base = { fecha, empleados: [{ id: "1", auth_user_id: "u1" }],
    configuraciones: [{ empleado_id: "1", dia_descanso: 0 }],
    excepciones: [{ empleado_id: "1", fecha, estado: "DESCANSA" }] };
  assert.equal(construirControlDiarioSucursal(base).personas[0].estado, "DESCANSA");
  assert.equal(construirControlDiarioSucursal({ ...base, asistencias: [{ empleado_id: "1", entrada_at: "2026-10-14T20:00:00Z" }] }).personas[0].estado, "PRESENTE");
});
