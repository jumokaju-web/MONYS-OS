import { supabase } from "../../../supabase";

export async function obtenerConciliacionesSicar(importacionId) {
  if (!importacionId) return [];
  const { data, error } = await supabase
    .from("conciliaciones_sicar_tesoreria")
    .select("id,importacion_detalle_id,cash_movement_id,fecha_sicar,importe_sicar,metodo_sicar,estado,registrado_por,registrado_en,motivo_anulacion,anulado_por,anulado_en")
    .eq("importacion_id", importacionId)
    .order("registrado_en", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar las conciliaciones SICAR: ${error.message}`);
  return data || [];
}

export async function registrarConciliacionSicar({
  organizationId,
  businessId,
  branchId,
  importacionId,
  detalleId,
  movimiento,
  fecha,
  monto,
}) {
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion || !sesion?.user?.id) throw new Error("Inicia sesión para confirmar el vínculo.");
  const { data, error } = await supabase
    .from("conciliaciones_sicar_tesoreria")
    .insert({
      organization_id: organizationId,
      business_id: businessId,
      branch_id: branchId,
      importacion_id: importacionId,
      importacion_detalle_id: detalleId,
      cash_movement_id: movimiento.id,
      fecha_sicar: fecha,
      importe_sicar: monto,
      metodo_sicar: "CH",
      registrado_por: sesion.user.id,
    })
    .select("id,importacion_detalle_id,cash_movement_id,fecha_sicar,importe_sicar,metodo_sicar,estado,registrado_por,registrado_en")
    .single();
  if (error) throw new Error(`No se pudo guardar el vínculo: ${error.message}`);
  return data;
}

export async function anularConciliacionSicar(conciliacionId, motivo) {
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion || !sesion?.user?.id) throw new Error("Inicia sesión para corregir el vínculo.");
  const { data, error } = await supabase
    .from("conciliaciones_sicar_tesoreria")
    .update({
      estado: "ANULADA",
      motivo_anulacion: String(motivo || "").trim(),
      anulado_por: sesion.user.id,
      anulado_en: new Date().toISOString(),
    })
    .eq("id", conciliacionId)
    .eq("estado", "ACTIVA")
    .select("id,estado,motivo_anulacion,anulado_en")
    .single();
  if (error) throw new Error(`No se pudo anular el vínculo: ${error.message}`);
  return data;
}
