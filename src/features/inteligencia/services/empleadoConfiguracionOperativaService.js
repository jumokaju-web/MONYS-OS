import { supabase } from "../../../supabase";

export const AREAS_OPERATIVAS = [
  { id: "VENTA_TIENDA", nombre: "Venta en tienda" },
  { id: "VENTA_WHATSAPP", nombre: "Ventas por WhatsApp" },
  { id: "PUBLICAR_GRUPOS_WHATSAPP", nombre: "Publicar en grupos" },
  { id: "CAJA_CORTE", nombre: "Caja y corte" },
  { id: "INVENTARIO_APOYO", nombre: "Bodega e inventario" },
];

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function revisarError(error, contexto) {
  if (!error) return;
  if (["42P01", "PGRST205"].includes(String(error.code || ""))) {
    throw new Error("La configuración de equipo todavía no está instalada en la base de MONYS.");
  }
  throw new Error(`${contexto}: ${error.message || "error de conexión"}`);
}

export async function obtenerConfiguracionOperativa(usuarioId) {
  if (!usuarioId) return null;
  const { data, error } = await supabase
    .from("empleado_configuracion_operativa")
    .select("empleado_id, usuario_id, branch_id, nombre_preferido, dia_descanso, area_asignada, turno_asignado, updated_at")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  revisarError(error, "No pudimos leer tu configuración");
  return data || null;
}

export async function guardarConfiguracionOperativa({
  empleadoId,
  usuarioId,
  branchId,
  nombrePreferido,
  diaDescanso,
  areaAsignada,
  turnoAsignado,
} = {}) {
  const nombre = String(nombrePreferido || "").trim();
  if (!empleadoId || !usuarioId || !branchId) {
    throw new Error("Tu cuenta todavía no está vinculada a una ficha activa de empleada y sucursal.");
  }
  if (!nombre) throw new Error("Escribe cómo prefieres que te llamemos.");
  if (!Number.isInteger(Number(diaDescanso)) || Number(diaDescanso) < 0 || Number(diaDescanso) > 6) {
    throw new Error("Selecciona tu día de descanso semanal.");
  }
  if (!AREAS_OPERATIVAS.some((area) => area.id === areaAsignada)) {
    throw new Error("Selecciona el área que te asignaron.");
  }
  if (!["PRIMERO", "SEGUNDO", "AMBOS"].includes(turnoAsignado)) {
    throw new Error("Selecciona tu turno asignado.");
  }

  const { data, error } = await supabase
    .from("empleado_configuracion_operativa")
    .upsert({
      empleado_id: empleadoId,
      usuario_id: usuarioId,
      branch_id: branchId,
      nombre_preferido: nombre,
      dia_descanso: Number(diaDescanso),
      area_asignada: areaAsignada,
      turno_asignado: turnoAsignado,
      updated_at: new Date().toISOString(),
    }, { onConflict: "empleado_id" })
    .select("empleado_id, usuario_id, branch_id, nombre_preferido, dia_descanso, area_asignada, turno_asignado, updated_at")
    .single();
  revisarError(error, "No pudimos guardar tu configuración");
  return data;
}

export async function obtenerConfiguracionesOperativasSucursal(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("empleado_configuracion_operativa")
    .select("empleado_id, usuario_id, branch_id, nombre_preferido, dia_descanso, area_asignada, turno_asignado")
    .eq("branch_id", branchId);
  revisarError(error, "No pudimos cargar los perfiles de la sucursal");
  return Array.isArray(data) ? data : [];
}
