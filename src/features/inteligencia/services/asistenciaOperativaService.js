import { supabase } from "../../../supabase";

export function fechaActualMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function revisarError(error, contexto) {
  if (!error) return;
  if (["42P01", "PGRST205"].includes(String(error.code || ""))) {
    throw new Error("El registro de entrada aún no está instalado en la base de MONYS.");
  }
  if (String(error.code || "") === "23505") {
    throw new Error("Tu entrada de hoy ya quedó registrada.");
  }
  throw new Error(`${contexto}: ${error.message || "error de conexión"}`);
}

export async function obtenerAsistenciaOperativa({ branchId, fecha } = {}) {
  if (!branchId || !fecha) return [];
  const { data, error } = await supabase
    .from("asistencia_operativa")
    .select("empleado_id, usuario_id, fecha, entrada_at, salida_at")
    .eq("branch_id", branchId)
    .eq("fecha", fecha)
    .order("entrada_at", { ascending: true });
  revisarError(error, "No pudimos consultar las entradas de la sucursal");
  return Array.isArray(data) ? data : [];
}

export async function obtenerEntradaEmpleado({ usuarioId, fecha } = {}) {
  if (!usuarioId || !fecha) return null;
  const { data, error } = await supabase
    .from("asistencia_operativa")
    .select("id, fecha, entrada_at, salida_at")
    .eq("usuario_id", usuarioId)
    .eq("fecha", fecha)
    .maybeSingle();
  revisarError(error, "No pudimos consultar tu entrada");
  return data || null;
}

export async function registrarEntradaOperativa({ usuario, fecha = fechaActualMexico() } = {}) {
  if (!usuario?.empleado_id || !usuario?.auth_user_id || !usuario?.organization_id || !usuario?.business_id || !usuario?.branch_id) {
    throw new Error("Esta cuenta necesita estar vinculada a una ficha activa y una sucursal para registrar entrada.");
  }
  const { data, error } = await supabase
    .from("asistencia_operativa")
    .insert({
      organization_id: usuario.organization_id,
      business_id: usuario.business_id,
      branch_id: usuario.branch_id,
      empleado_id: usuario.empleado_id,
      usuario_id: usuario.auth_user_id,
      fecha,
    })
    .select("id, fecha, entrada_at, salida_at")
    .single();
  revisarError(error, "No pudimos registrar tu entrada");
  return data;
}

export async function registrarSalidaOperativa({ entradaId, usuarioId } = {}) {
  if (!entradaId || !usuarioId) throw new Error("Primero registra tu entrada.");
  const { data, error } = await supabase.from("asistencia_operativa")
    .update({ salida_at: new Date().toISOString() })
    .eq("id", entradaId).eq("usuario_id", usuarioId).is("salida_at", null)
    .select("id, fecha, entrada_at, salida_at").maybeSingle();
  revisarError(error, "No pudimos registrar tu salida");
  if (!data) throw new Error("No se confirmó la salida. Actualiza para revisar si ya quedó registrada.");
  return data;
}
