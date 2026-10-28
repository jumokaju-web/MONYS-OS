import { supabase } from "../../../supabase";

function errorFinanciero(error) {
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code)) {
    return new Error("El registro semanal aún no está activado en la base de datos.");
  }
  return new Error(error?.message || "No fue posible guardar el remanente semanal.");
}

function nombreSeguro(valor = "caja") {
  return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function obtenerRemanentesSemanales({ businessId, semanaInicio }) {
  const { data, error } = await supabase.rpc("obtener_remanentes_semanales_caja", {
    p_business_id: businessId,
    p_semana_inicio: semanaInicio,
  });
  if (error) throw errorFinanciero(error);
  return data || [];
}

export async function subirEvidenciaRemanente({ archivo, branchId, cajaId, semanaInicio }) {
  if (!archivo) return null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const usuarioId = authData?.user?.id;
  if (authError || !usuarioId) throw new Error("Tu sesión venció. Inicia sesión de nuevo.");
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ruta = `${usuarioId}/remanentes-semanales/${nombreSeguro(branchId)}/${nombreSeguro(cajaId)}/${semanaInicio}/${id}-${nombreSeguro(archivo.name)}`;
  const { error } = await supabase.storage.from("tesoreria-comprobantes").upload(ruta, archivo, {
    cacheControl: "3600",
    upsert: false,
    contentType: archivo.type || undefined,
  });
  if (error) throw new Error(`No fue posible subir la evidencia: ${error.message}`);
  return ruta;
}

export async function guardarRemanenteSemanal({ form, evidenciaPath, registro }) {
  const { data, error } = await supabase.rpc("registrar_remanente_semanal_caja", {
    p_organization_id: form.organizationId,
    p_business_id: form.businessId,
    p_branch_id: form.branchId,
    p_semana_inicio: form.semanaInicio,
    p_semana_fin: form.semanaFin,
    p_caja_id: form.cajaId,
    p_importacion_id: form.importacionId,
    p_importacion_detalle_id: form.importacionDetalleId,
    p_version: Number(registro?.version || 0),
    p_efectivo_sicar: Number(form.efectivoSicar),
    p_efectivo_contado: Number(form.efectivoContado),
    p_fondo_fijo: Number(form.fondoFijo),
    p_monto_resguardado: Number(form.montoResguardado),
    p_destino: form.destino,
    p_referencia: form.referencia,
    p_evidencia_path: evidenciaPath,
    p_nota: String(form.nota || "").trim() || null,
  });
  if (error) throw errorFinanciero(error);
  return data;
}

export async function revisarRemanenteSemanal({ registro, estado, nota }) {
  const { data, error } = await supabase.rpc("revisar_remanente_semanal_caja", {
    p_remanente_id: registro.id,
    p_version: registro.version,
    p_estado: estado,
    p_nota: String(nota || "").trim(),
  });
  if (error) throw errorFinanciero(error);
  return data;
}

export async function abrirEvidenciaRemanente(path) {
  const { data, error } = await supabase.storage.from("tesoreria-comprobantes").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "No fue posible abrir la evidencia.");
  return data.signedUrl;
}

export async function eliminarEvidenciaRemanente(path) {
  if (!path) return;
  const { error } = await supabase.storage.from("tesoreria-comprobantes").remove([path]);
  if (error) throw new Error(`No se pudo limpiar la evidencia sin guardar: ${error.message}`);
}
