import { supabase } from "../../../supabase";
import { validarConteoImportacionSicar } from "../shared/resumenComisionesSicar";

export async function listarOportunidadesGanadasComision({ branchId, businessId } = {}) {
  if (!branchId || !businessId) return [];
  const { data: oportunidades, error } = await supabase.from("crm_oportunidades")
    .select("id, branch_id, folio_venta_sicar, empleado_id, etapa")
    .eq("branch_id", branchId).eq("etapa", "GANADO").not("folio_venta_sicar", "is", null);
  if (error) throw error;
  if (!Array.isArray(oportunidades) || !oportunidades.length) return [];

  const ids = oportunidades.map((item) => item.id);
  const [interacciones, equipo] = await Promise.all([
    supabase.from("crm_interacciones").select("oportunidad_id, registrado_por").in("oportunidad_id", ids),
    supabase.from("empleados").select("id, nombre, usuario_id").eq("business_id", businessId),
  ]);
  const participacionVerificada = !interacciones.error && !equipo.error;
  const empleadoPorUsuario = new Map(
    (equipo.data || []).filter((item) => item.usuario_id).map((item) => [item.usuario_id, item]),
  );
  const empleadosPorId = new Map((equipo.data || []).map((item) => [item.id, item]));
  const usuariosPorOportunidad = new Map();
  const participacionNoIdentificada = new Set();
  if (participacionVerificada) {
    for (const fila of interacciones.data || []) {
      if (!fila.registrado_por || !empleadoPorUsuario.has(fila.registrado_por)) {
        participacionNoIdentificada.add(fila.oportunidad_id);
        continue;
      }
      const grupo = usuariosPorOportunidad.get(fila.oportunidad_id) || new Set();
      grupo.add(fila.registrado_por);
      usuariosPorOportunidad.set(fila.oportunidad_id, grupo);
    }
  }
  return oportunidades.map((oportunidad) => {
    const participantes = new Set(oportunidad.empleado_id ? [oportunidad.empleado_id] : []);
    for (const usuarioId of usuariosPorOportunidad.get(oportunidad.id) || []) {
      const persona = empleadoPorUsuario.get(usuarioId);
      if (persona?.id) participantes.add(persona.id);
    }
    const idsParticipantes = [...participantes];
    return {
      ...oportunidad,
      participacion_verificada: participacionVerificada && !participacionNoIdentificada.has(oportunidad.id),
      participantes_empleado_ids: idsParticipantes,
      participantes_empleados: idsParticipantes.map((id) => ({ id, nombre: empleadosPorId.get(id)?.nombre || "" })),
      empleado_nombre: empleadosPorId.get(oportunidad.empleado_id)?.nombre || "",
    };
  });
}

export async function listarImportacionesUtilidadVentas(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("importaciones")
    .select("id, archivo_original, created_at, total_filas, branch_id")
    .eq("branch_id", branchId)
    .eq("tipo_reporte", "Utilidad de ventas")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return validarConteoImportacionSicar({ filas: data, totalFilasEsperadas });
}

export async function leerDetalleImportacionVentas(importacionId, totalFilasEsperadas) {
  if (!importacionId) return [];
  const { data, error } = await supabase
    .from("importacion_detalle")
    .select("numero_fila, datos_originales")
    .eq("importacion_id", importacionId)
    .order("numero_fila", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function listarEmpleadosComision(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("empleados")
    .select("id, nombre, puesto, branch_id, business_id, usuario_id, usuario_sicar, active")
    .eq("branch_id", branchId)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function guardarUsuarioSicarEmpleado({ empleadoId, usuarioSicar } = {}) {
  if (!empleadoId || !String(usuarioSicar || "").trim()) {
    throw new Error("Selecciona un usuario de SICAR y una empleada.");
  }
  const { data, error } = await supabase
    .from("empleados")
    .update({ usuario_sicar: String(usuarioSicar).trim(), updated_at: new Date().toISOString() })
    .eq("id", empleadoId)
    .select("id, nombre, usuario_sicar")
    .single();
  if (error) throw error;
  return data;
}
