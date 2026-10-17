import { supabase } from "../../../supabase";
import { fechaActualMexico } from "../../inteligencia/services/asistenciaOperativaService";
import { validarCancelacionDuplicados } from "../utils/higieneBacklogOperativo";

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
