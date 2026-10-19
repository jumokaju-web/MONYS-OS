import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analizarBacklogOperativo,
  construirColaRescateBacklog,
  construirInstruccionesReprogramadas,
  firmaDuplicadoExacto,
  normalizarTextoBacklog,
  validarCancelacionDuplicados,
  validarReprogramacionTarea,
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

test("prioriza vencidas sin incluir copias exactas y protege tareas iniciadas", () => {
  const datos = [
    tarea("t1", { fecha: "2026-10-01", prioridad: "alta", responsable_usuario_id: null }),
    tarea("t2", { fecha: "2026-10-01", prioridad: "alta", responsable_usuario_id: null }),
    tarea("t3", { fecha: "2026-09-20", estado: "en_proceso" }),
    tarea("t4", { fecha: "2026-10-16", prioridad: "baja" }),
  ];
  const cola = construirColaRescateBacklog(datos, { hoy: "2026-10-17" });
  assert.equal(cola.total, 3);
  assert.deepEqual(cola.candidatas.map((item) => item.id), ["t1", "t4"]);
  assert.equal(cola.requierenRevision[0].id, "t3");
  assert.equal(cola.sinUsuarioVinculado, 1);
});

test("reprogramar exige fecha vigente, responsable conectado, motivo, criterio y autorización", () => {
  const base = {
    tarea: tarea("t1"),
    hoy: "2026-10-17",
    nuevaFecha: "2026-10-18",
    responsableEmpleadoId: "e1",
    responsableUsuarioId: "u1",
    criterioExito: "Conteo físico confirmado",
    motivo: "La tarea no se asignó a una cuenta activa.",
    confirmacion: "REPROGRAMAR",
  };
  assert.equal(validarReprogramacionTarea(base).valida, true);
  assert.equal(validarReprogramacionTarea({ ...base, nuevaFecha: "2026-10-16" }).valida, false);
  assert.equal(validarReprogramacionTarea({ ...base, responsableUsuarioId: null }).valida, false);
  assert.equal(validarReprogramacionTarea({ ...base, confirmacion: "SI" }).valida, false);
  assert.equal(validarReprogramacionTarea({ ...base, tarea: tarea("t1", { estado: "en_proceso" }) }).valida, false);
});

test("la reprogramación agrega auditoría sin borrar instrucciones anteriores", () => {
  const texto = construirInstruccionesReprogramadas({
    instruccionesAnteriores: "Contar y fotografiar.",
    fechaAnterior: "2026-10-10",
    nuevaFecha: "2026-10-18",
    motivo: "No tenía responsable vinculado.",
    autorizadoPor: "u-direccion",
    autorizadoAt: "2026-10-17T20:00:00Z",
  });
  assert.match(texto, /Contar y fotografiar/);
  assert.match(texto, /Fecha anterior: 2026-10-10/);
  assert.match(texto, /Autorizó usuario: u-direccion/);
});

test("el plan móvil abre otra vista y deja de desplegar una lista larga en el dashboard", () => {
  const componente = readFileSync(
    new URL("../../src/features/dashboard/components/HigieneBacklogOperativo.jsx", import.meta.url),
    "utf8",
  );
  const app = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  assert.match(componente, /vista === "pagina"/);
  assert.match(componente, /onVolverDashboard/);
  assert.match(componente, /backlog-page__pager/);
  assert.doesNotMatch(componente, /scrollIntoView/);
  assert.doesNotMatch(componente, /candidatas\.slice\(0, 6\)/);
  assert.match(app, /pantallaActual === "rescate-backlog"/);
  assert.match(app, /scrollDashboardAntesRescate/);
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
