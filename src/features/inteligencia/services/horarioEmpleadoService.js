import { supabase } from "../../../supabase";

function revisarError(error, contexto) {
  if (!error) return;
  if (["42P01", "PGRST205"].includes(String(error.code || ""))) {
    throw new Error("El calendario flexible todavía no está instalado en la base de MONYS.");
  }
  throw new Error(`${contexto}: ${error.message || "error de conexión"}`);
}

export async function obtenerSucursalesHorario(businessId) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, active")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("name");
  revisarError(error, "No pudimos cargar las sucursales");
  return Array.isArray(data) ? data : [];
}

export async function obtenerHorariosEmpleados(empleadoIds = []) {
  const ids = [...new Set((Array.isArray(empleadoIds) ? empleadoIds : []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("empleado_horario_semanal")
    .select("id, empleado_id, branch_id, dia_semana, estado, hora_inicio, hora_fin, nota, updated_at")
    .in("empleado_id", ids)
    .order("dia_semana");
  revisarError(error, "No pudimos cargar los horarios semanales");
  return Array.isArray(data) ? data : [];
}

export async function obtenerExcepcionesHorario({ empleadoIds = [], fechaDesde, fechaHasta } = {}) {
  const ids = [...new Set((Array.isArray(empleadoIds) ? empleadoIds : []).filter(Boolean))];
  if (!ids.length || !fechaDesde || !fechaHasta) return [];
  const { data, error } = await supabase
    .from("empleado_horario_excepcion")
    .select("id, empleado_id, branch_id, fecha, estado, hora_inicio, hora_fin, motivo, updated_at")
    .in("empleado_id", ids)
    .gte("fecha", fechaDesde)
    .lte("fecha", fechaHasta)
    .order("fecha");
  revisarError(error, "No pudimos cargar los cambios de horario");
  return Array.isArray(data) ? data : [];
}

export async function guardarHorarioSemanal({ empleado, filas } = {}) {
  if (!empleado?.id || !empleado?.organization_id || !empleado?.business_id) {
    throw new Error("La ficha necesita organización y negocio antes de guardar el horario.");
  }
  const lista = Array.isArray(filas) ? filas : [];
  if (lista.length !== 7) throw new Error("Completa los siete días de la semana.");
  const { data: sesion } = await supabase.auth.getUser();
  const authId = sesion?.user?.id;
  if (!authId) throw new Error("Tu sesión terminó. Vuelve a entrar para guardar el horario.");
  const registros = lista.map((fila) => ({
    organization_id: empleado.organization_id,
    business_id: empleado.business_id,
    empleado_id: empleado.id,
    branch_id: fila.branchId || empleado.branch_id,
    dia_semana: Number(fila.diaSemana),
    estado: fila.estado,
    hora_inicio: fila.estado === "TRABAJA" ? fila.horaInicio : null,
    hora_fin: fila.estado === "TRABAJA" ? fila.horaFin : null,
    nota: String(fila.nota || "").trim() || null,
    changed_by: authId,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from("empleado_horario_semanal")
    .upsert(registros, { onConflict: "empleado_id,dia_semana" })
    .select("id, empleado_id, branch_id, dia_semana, estado, hora_inicio, hora_fin, nota, updated_at");
  revisarError(error, "No pudimos guardar el horario semanal");
  return Array.isArray(data) ? data : [];
}

export async function guardarExcepcionHorario({ empleado, fecha, branchId, estado, horaInicio, horaFin, motivo } = {}) {
  if (!empleado?.id || !empleado?.organization_id || !empleado?.business_id || !fecha || !branchId) {
    throw new Error("Faltan la empleada, fecha o sucursal del cambio.");
  }
  const razon = String(motivo || "").trim();
  if (razon.length < 3) throw new Error("Escribe por qué cambió el horario.");
  const { data: sesion } = await supabase.auth.getUser();
  const authId = sesion?.user?.id;
  if (!authId) throw new Error("Tu sesión terminó. Vuelve a entrar para guardar el cambio.");
  const { data, error } = await supabase
    .from("empleado_horario_excepcion")
    .upsert({
      organization_id: empleado.organization_id,
      business_id: empleado.business_id,
      empleado_id: empleado.id,
      branch_id: branchId,
      fecha,
      estado,
      hora_inicio: estado === "TRABAJA" ? horaInicio : null,
      hora_fin: estado === "TRABAJA" ? horaFin : null,
      motivo: razon,
      changed_by: authId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "empleado_id,fecha" })
    .select("id, empleado_id, branch_id, fecha, estado, hora_inicio, hora_fin, motivo, updated_at")
    .single();
  revisarError(error, "No pudimos guardar el cambio de horario");
  return data;
}
