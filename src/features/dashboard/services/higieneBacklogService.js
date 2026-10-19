import { supabase } from "../../../supabase";
import { fechaActualMexico } from "../../inteligencia/services/asistenciaOperativaService";
import {
  construirInstruccionesRescate,
  validarCancelacionDuplicados,
  validarReprogramacionTarea,
} from "../utils/higieneBacklogOperativo";

const COLUMNAS = [
  "id", "organization_id", "business_id", "branch_id", "titulo", "descripcion",
  "area", "responsable", "responsable_usuario_id", "prioridad", "estado", "fecha",
  "hora_limite", "instrucciones", "resultado", "created_at", "updated_at",
  "requiere_evidencia", "criterio_exito", "requiere_revision", "checklist",
].join(",");

export async function obtenerBacklogOperativo({ organizationId, businessId } = {}) {
  if (!organizationId || !businessId) {
    throw new Error("Falta identificar la organización y el negocio.");
  }

  const { data, error } = await supabase
    .from("tareas_operativas")
    .select(COLUMNAS)
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .in("estado", ["pendiente", "en_proceso", "analizando"])
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function obtenerResponsablesRescate({ organizationId, businessId } = {}) {
  if (!organizationId || !businessId) {
    throw new Error("Falta identificar la organización y el negocio.");
  }

  const { data: empleados, error: errorEmpleados } = await supabase
    .from("empleados")
    .select("id,organization_id,business_id,branch_id,nombre,puesto,usuario_id,active")
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .eq("active", true)
    .order("nombre", { ascending: true });
  if (errorEmpleados) throw errorEmpleados;

  const ids = (empleados || []).map((empleado) => empleado.id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: perfiles, error: errorPerfiles } = await supabase
    .from("empleado_configuracion_operativa")
    .select("empleado_id,usuario_id,branch_id")
    .in("empleado_id", ids);
  if (errorPerfiles) throw errorPerfiles;
  const perfilPorEmpleado = new Map((perfiles || []).map((perfil) => [perfil.empleado_id, perfil]));

  return (empleados || []).map((empleado) => ({
    ...empleado,
    responsable_usuario_id: perfilPorEmpleado.get(empleado.id)?.usuario_id || empleado.usuario_id || null,
    accesoConfirmado: Boolean(perfilPorEmpleado.get(empleado.id)?.usuario_id || empleado.usuario_id),
  }));
}

export async function reprogramarTareaVencida({
  organizationId,
  businessId,
  tareaId,
  versionOriginal,
  nuevaFecha,
  responsableEmpleadoId,
  criterioExito,
  motivo,
  confirmacion,
  alcanceExacto,
  pasos,
  evidencias,
} = {}) {
  if (!organizationId || !businessId || !tareaId || !versionOriginal) {
    throw new Error("Falta el alcance o la versión original de la tarea.");
  }

  const [{ data: sesion, error: errorSesion }, { data: tarea, error: errorTarea }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("tareas_operativas")
      .select(COLUMNAS)
      .eq("id", tareaId)
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  if (errorSesion || !sesion?.user?.id) {
    throw new Error("La sesión no está disponible. Inicia sesión nuevamente.");
  }
  if (errorTarea) throw errorTarea;
  if (!tarea || tarea.updated_at !== versionOriginal) {
    throw new Error("La tarea cambió desde que la abriste. Actualiza antes de decidir.");
  }
  if (!tarea.branch_id) {
    throw new Error("La tarea no tiene sucursal. Completa ese dato antes de reasignarla.");
  }

  const { data: empleado, error: errorEmpleado } = await supabase
    .from("empleados")
    .select("id,nombre,usuario_id,branch_id,active")
    .eq("id", responsableEmpleadoId)
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .eq("branch_id", tarea.branch_id)
    .eq("active", true)
    .maybeSingle();
  if (errorEmpleado) throw errorEmpleado;
  if (!empleado) throw new Error("La empleada seleccionada ya no está activa en esta sucursal.");

  const { data: perfiles, error: errorPerfil } = await supabase
    .from("empleado_configuracion_operativa")
    .select("empleado_id,usuario_id,branch_id")
    .eq("empleado_id", empleado.id);
  if (errorPerfil) throw errorPerfil;
  const perfilSucursal = (perfiles || []).find((perfil) => perfil.branch_id === tarea.branch_id);
  const responsableUsuarioId = perfilSucursal?.usuario_id || empleado.usuario_id || null;

  const validacion = validarReprogramacionTarea({
    tarea,
    hoy: fechaActualMexico(),
    nuevaFecha,
    responsableEmpleadoId,
    responsableUsuarioId,
    criterioExito,
    motivo,
    confirmacion,
    alcanceExacto,
    pasos,
    evidencias,
  });
  if (!validacion.valida) throw new Error(validacion.motivo);

  const ahora = new Date().toISOString();
  const instrucciones = construirInstruccionesRescate({
    alcanceExacto,
    pasos,
    evidencias,
    instruccionesAnteriores: tarea.instrucciones,
    fechaAnterior: validacion.fechaAnterior,
    nuevaFecha: validacion.fechaNueva,
    motivo,
    autorizadoPor: sesion.user.id,
    autorizadoAt: ahora,
  });

  const { data: actualizada, error: errorActualizacion } = await supabase
    .from("tareas_operativas")
    .update({
      fecha: validacion.fechaNueva,
      responsable: empleado.nombre,
      responsable_usuario_id: responsableUsuarioId,
      criterio_exito: String(criterioExito).trim(),
      requiere_evidencia: true,
      instrucciones,
      checklist: pasos.map((paso, indice) => ({
        id: indice,
        texto: String(paso).trim(),
        completado: false,
      })),
      updated_at: ahora,
    })
    .eq("id", tarea.id)
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .eq("branch_id", tarea.branch_id)
    .eq("estado", "pendiente")
    .eq("updated_at", versionOriginal)
    .select(COLUMNAS)
    .maybeSingle();

  if (errorActualizacion) throw errorActualizacion;
  if (!actualizada) {
    throw new Error("La tarea cambió durante la autorización. No se modificó; actualiza y revisa nuevamente.");
  }
  return actualizada;
}

export async function cancelarCopiasExactas({
  organizationId,
  businessId,
  principalId,
  duplicadaIds,
  confirmacion,
} = {}) {
  if (confirmacion !== "CONSERVAR UNA") {
    throw new Error('Escribe exactamente "CONSERVAR UNA" para autorizar esta decisión.');
  }
  if (!organizationId || !businessId || !principalId || !Array.isArray(duplicadaIds) || duplicadaIds.length === 0) {
    throw new Error("La selección está incompleta.");
  }

  const ids = [principalId, ...new Set(duplicadaIds)];
  const [{ data: usuarioData, error: usuarioError }, { data: tareas, error: tareasError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("tareas_operativas")
      .select(COLUMNAS)
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .in("id", ids),
  ]);

  if (usuarioError || !usuarioData?.user?.id) {
    throw new Error("La sesión no está disponible. Inicia sesión nuevamente antes de decidir.");
  }
  if (tareasError) throw tareasError;

  const validacion = validarCancelacionDuplicados({
    tareas,
    principalId,
    duplicadaIds,
    hoy: fechaActualMexico(),
  });
  if (!validacion.valida) throw new Error(validacion.motivo);

  const marca = new Date().toISOString();
  const resultadoAuditoria = [
    "MONYS OS · HIGIENE DE BACKLOG",
    "Decisión autorizada: CANCELAR COPIA EXACTA",
    `Tarea conservada: ${principalId}`,
    `Autorizó usuario: ${usuarioData.user.id}`,
    `Fecha de autorización: ${marca}`,
    "Criterio: misma fecha, sucursal, área, responsable, título, instrucciones, hora, checklist y criterio de éxito.",
  ].join(" | ");

  const { data: actualizadas, error: actualizacionError } = await supabase
    .from("tareas_operativas")
    .update({ estado: "cancelada", resultado: resultadoAuditoria })
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .eq("branch_id", validacion.grupo.principal.branch_id)
    .eq("estado", "pendiente")
    .in("id", duplicadaIds)
    .select("id");

  if (actualizacionError) throw actualizacionError;
  if ((actualizadas || []).length !== duplicadaIds.length) {
    throw new Error("No se modificaron todas las copias. Actualiza para comprobar el estado real.");
  }

  return {
    principalId,
    canceladas: actualizadas.map((item) => item.id),
    auditoria: resultadoAuditoria,
  };
}
