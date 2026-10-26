import { supabase } from "../../../supabase";
import { validarReporteRetiro } from "../utils/comprobacionRetiros.js";

function mensajeError(error) {
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code)) {
    return new Error("La comprobación de retiros aún no está activada en la base de datos.");
  }
  return new Error(error?.message || "No fue posible completar la comprobación del retiro.");
}

function nombreSeguro(nombre = "comprobante") {
  return nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function obtenerComprobacionesRetiros(cierreIds = []) {
  const ids = [...new Set(cierreIds.filter(Boolean))].slice(0, 100);
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc("obtener_comprobaciones_retiros_efectivo", { p_cierre_ids: ids });
  if (error) throw mensajeError(error);
  return data || [];
}

export async function subirComprobanteRetiro({ archivo, retiro }) {
  const validacion = validarReporteRetiro({
    retiro,
    destinoReal: "pendiente",
    referencia: "pendiente",
    evidencia: archivo,
  });
  if (validacion && !/destino|referencia/i.test(validacion)) throw new Error(validacion);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) throw new Error("Tu sesión venció. Inicia sesión de nuevo.");
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ruta = `${authData.user.id}/retiros-caja/${retiro.cierreId}/${nombreSeguro(retiro.cajaId)}/${id}-${nombreSeguro(archivo.name)}`;
  const { error } = await supabase.storage.from("tesoreria-comprobantes").upload(ruta, archivo, {
    cacheControl: "3600", upsert: false, contentType: archivo.type || undefined,
  });
  if (error) throw new Error(`No fue posible subir el comprobante: ${error.message}`);
  return ruta;
}

export async function guardarReporteRetiro({ retiro, destinoReal, referencia, evidencia }) {
  const validacion = validarReporteRetiro({ retiro, destinoReal, referencia, evidencia });
  if (validacion) throw new Error(validacion);
  let ruta = null;
  try {
    ruta = await subirComprobanteRetiro({ archivo: evidencia, retiro });
    const { data, error } = await supabase.rpc("registrar_comprobacion_retiro_efectivo", {
      p_cierre_id: retiro.cierreId,
      p_caja_id: retiro.cajaId,
      p_version: retiro.comprobacion?.version || 0,
      p_monto: retiro.monto,
      p_destino_real: destinoReal.trim(),
      p_referencia: referencia.trim(),
      p_evidencia_path: ruta,
    });
    if (error) throw mensajeError(error);
    return data;
  } catch (error) {
    if (ruta) await supabase.storage.from("tesoreria-comprobantes").remove([ruta]);
    throw error;
  }
}

export async function revisarReporteRetiro({ comprobacion, estado, nota }) {
  const { data, error } = await supabase.rpc("revisar_comprobacion_retiro_efectivo", {
    p_comprobacion_id: comprobacion.id,
    p_version: comprobacion.version,
    p_estado: estado,
    p_nota: String(nota || "").trim(),
  });
  if (error) throw mensajeError(error);
  return data;
}

export async function abrirComprobanteRetiro(path) {
  const { data, error } = await supabase.storage.from("tesoreria-comprobantes").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "No fue posible abrir el comprobante.");
  return data.signedUrl;
}
