import test from "node:test";
import assert from "node:assert/strict";
import {
  analizarBacklogOperativo,
  firmaDuplicadoExacto,
  normalizarTextoBacklog,
  validarCancelacionDuplicados,
} from "../../src/features/dashboard/utils/higieneBacklogOperativo.js";

function tarea(id, cambios = {}) {
  return {
    id,
    organization_id: "o1",
    business_id: "n1",
    branch_id: "s1",
    titulo: "Revisar inventario",
    descripcion: "Contar producto físico",
    instrucciones: "Adjuntar evidencia",
    area: "inventario",
    responsable: "Karla",
    responsable_usuario_id: "u1",
    prioridad: "alta",
    estado: "pendiente",
    fecha: "2026-10-16",
    resultado: null,
    requiere_evidencia: true,
    requiere_revision: false,
    checklist: [{ texto: "Contar", completado: false }],
    criterio_exito: "Conteo confirmado",
    created_at: `2026-10-16T10:0${id.slice(-1)}:00Z`,
    ...cambios,
  };
}

test("normaliza acentos, signos, mayúsculas y espacios sin inventar contenido", () => {
  assert.equal(normalizarTextoBacklog("  REVISIÓN: física  "), "revision fisica");
});

test("propone solo copias exactas del mismo alcance y fecha", () => {
  const datos = [tarea("t1"), tarea("t2", { titulo: "REVISAR inventário!!!" })];
  const analisis = analizarBacklogOperativo(datos, { hoy: "2026-10-17" });
  assert.equal(analisis.gruposDuplicados.length, 1);
  assert.equal(analisis.copiasExactas, 1);
  assert.equal(analisis.gruposDuplicados[0].principal.id, "t1");
});

test("no mezcla tareas iguales de otra fecha, sucursal, área o responsable", () => {
  const base = tarea("t1");
  const datos = [
    base,
    tarea("t2", { fecha: "2026-10-15" }),
    tarea("t3", { branch_id: "s2" }),
    tarea("t4", { area: "tienda" }),
    tarea("t5", { responsable_usuario_id: "u2" }),
    tarea("t6", { hora_limite: "18:00:00" }),
    tarea("t7", { requiere_revision: true }),
  ];
  assert.equal(analizarBacklogOperativo(datos, { hoy: "2026-10-17" }).copiasExactas, 0);
  assert.notEqual(firmaDuplicadoExacto(base), firmaDuplicadoExacto(datos[1]));
});

test("protege trabajo en proceso, en análisis o con resultado", () => {
  const datos = [
    tarea("t1"),
    tarea("t2", { estado: "en_proceso" }),
    tarea("t3", { estado: "analizando" }),
    tarea("t4", { resultado: "Conteo parcial guardado" }),
  ];
  const analisis = analizarBacklogOperativo(datos, { hoy: "2026-10-17" });
  assert.equal(analisis.copiasExactas, 0);
  assert.equal(analisis.protegidas.length, 3);
});

test("separa vencidas, actuales, futuras y fechas imposibles", () => {
  const analisis = analizarBacklogOperativo([
    tarea("t1", { fecha: "2026-10-16" }),
    tarea("t2", { fecha: "2026-10-17" }),
    tarea("t3", { fecha: "2026-10-18" }),
    tarea("t4", { fecha: "fecha-imposible" }),
  ], { hoy: "2026-10-17" });
  assert.equal(analisis.vencidas.length, 1);
  assert.equal(analisis.deHoy.length, 1);
  assert.equal(analisis.futuras.length, 1);
  assert.equal(analisis.fechaPendiente.length, 1);
});

test("bloquea la cancelación si la selección cambia o incluye la principal", () => {
  const datos = [tarea("t1"), tarea("t2")];
  assert.equal(validarCancelacionDuplicados({ tareas: datos, principalId: "t1", duplicadaIds: ["t2"], hoy: "2026-10-17" }).valida, true);
  assert.equal(validarCancelacionDuplicados({ tareas: datos, principalId: "t1", duplicadaIds: ["t1"], hoy: "2026-10-17" }).valida, false);
  assert.equal(validarCancelacionDuplicados({ tareas: [tarea("t1"), tarea("t2", { estado: "en_proceso" })], principalId: "t1", duplicadaIds: ["t2"], hoy: "2026-10-17" }).valida, false);
});
