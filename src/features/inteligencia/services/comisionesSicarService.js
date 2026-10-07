import { supabase } from "../../../supabase";

export async function listarOportunidadesGanadasComision(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase.from("crm_oportunidades")
    .select("id, branch_id, folio_venta_sicar, empleado_id, etapa")
    .eq("branch_id", branchId).eq("etapa", "GANADO").not("folio_venta_sicar", "is", null);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
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
  return Array.isArray(data) ? data : [];
}

export async function leerDetalleImportacionVentas(importacionId) {
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
    .select("id, nombre, puesto, branch_id, business_id, usuario_sicar, active")
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
