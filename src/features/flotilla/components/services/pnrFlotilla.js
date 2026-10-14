import { supabase } from "../../../../supabase";
import { validarArchivoIncidencia } from "../../utils/incidenciasFlotilla";
import { validarAltaPnr, validarDescuentoPnr } from "../../utils/pnrFlotilla";

const BUCKET = "flotilla-evidencias";

function extensionDeArchivo(archivo) {
  if (archivo?.type === "image/png") return "png";
  if (archivo?.type === "image/webp") return "webp";
  return "jpg";
}

async function obtenerAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Tu sesión terminó. Vuelve a iniciar sesión.");
  return data.user;
}

async function subirImagen({ archivo, authUserId, rutaId, pnrId, nombre }) {
  const errorArchivo = validarArchivoIncidencia(archivo);
  if (errorArchivo) throw new Error(errorArchivo);
  const path = `${authUserId}/${rutaId}/pnr/${pnrId}/${nombre}.${extensionDeArchivo(archivo)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    cacheControl: "3600",
    contentType: archivo.type,
    upsert: false,
  });
  if (error) throw new Error(error.message || "No fue posible guardar la evidencia del PNR.");
  return path;
}

async function crearUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return error ? null : data?.signedUrl || null;
}

export async function obtenerRutasParaPnr({ desde, hasta }) {
  const { data, error } = await supabase
    .from("flotilla_rutas")
    .select("id, fecha, codigo_ruta, chofer_nombre, driver_auth_user_id, unidad:flotilla_unidades(placas)")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .not("driver_auth_user_id", "is", null)
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message || "No fue posible cargar las rutas para el PNR.");
  return Array.isArray(data) ? data : [];
}

export async function registrarPnrFlotilla({ rutaId, paqueteId, referenciaOperativa, descripcion, captura }) {
  const errores = validarAltaPnr({ rutaId, paqueteId, captura });
  if (errores.length) throw new Error(errores[0]);
  const errorArchivo = validarArchivoIncidencia(captura);
  if (errorArchivo) throw new Error(errorArchivo);

  const authUser = await obtenerAuthUser();
  const pnrId = crypto.randomUUID();
  let capturaPath = "";
  try {
    capturaPath = await subirImagen({
      archivo: captura,
      authUserId: authUser.id,
      rutaId,
      pnrId,
      nombre: "aviso-whatsapp",
    });
    const { data, error } = await supabase
      .from("flotilla_pnr_expedientes")
      .insert({
        id: pnrId,
        ruta_id: rutaId,
        paquete_id: String(paqueteId).trim(),
        referencia_operativa: String(referenciaOperativa || "").trim() || null,
        descripcion: String(descripcion || "").trim() || null,
        captura_origen_path: capturaPath,
      })
      .select("id, paquete_id, estado, created_at")
      .single();
    if (error) throw new Error(error.message || "No fue posible registrar el PNR.");
    return data;
  } catch (error) {
    if (capturaPath) await supabase.storage.from(BUCKET).remove([capturaPath]);
    throw error;
  }
}

export async function obtenerPnrFlotilla() {
  const { data, error } = await supabase
    .from("flotilla_pnr_expedientes")
    .select(`
      id, organization_id, ruta_id, unidad_id, driver_auth_user_id, chofer_nombre,
      paquete_id, referencia_operativa, fecha_reporte, descripcion, captura_origen_path,
      estado, enterado_at, respuesta_chofer, respuesta_at, penalidad_monto, saldo,
      convenio_solicitado_monto, convenio_autorizado_monto, resolucion, resuelto_at,
      created_at, updated_at,
      ruta:flotilla_rutas(codigo_ruta, fecha),
      unidad:flotilla_unidades(placas),
      evidencias:flotilla_pnr_evidencias(id, archivo_path, nota, creado_por, created_at),
      descuentos:flotilla_pnr_descuentos(id, periodo_desde, periodo_hasta, monto, aplica_socio, aplica_chofer, estado, observaciones, created_at)
    `)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "No fue posible consultar los PNR.");

  return Promise.all((data || []).map(async (item) => ({
    ...item,
    captura_origen_url: await crearUrl(item.captura_origen_path),
    evidencias: await Promise.all((item.evidencias || []).map(async (evidencia) => ({
      ...evidencia,
      archivo_url: await crearUrl(evidencia.archivo_path),
    }))),
  })));
}

export async function agregarEvidenciaPnr({ pnr, archivo, nota }) {
  if (!pnr?.id || !pnr?.ruta_id) throw new Error("No se identificó el PNR.");
  const authUser = await obtenerAuthUser();
  let archivoPath = "";
  try {
    archivoPath = await subirImagen({
      archivo,
      authUserId: authUser.id,
      rutaId: pnr.ruta_id,
      pnrId: pnr.id,
      nombre: `evidencia-${Date.now()}`,
    });
    const { data, error } = await supabase
      .from("flotilla_pnr_evidencias")
      .insert({ pnr_id: pnr.id, archivo_path: archivoPath, nota: String(nota || "").trim() || null })
      .select("id, archivo_path, nota, created_at")
      .single();
    if (error) throw new Error(error.message || "No fue posible agregar la evidencia.");
    return data;
  } catch (error) {
    if (archivoPath) await supabase.storage.from(BUCKET).remove([archivoPath]);
    throw error;
  }
}

export async function responderPnrFlotilla({ pnr, respuesta, evidencia }) {
  if (!String(respuesta || "").trim()) throw new Error("Explica qué ocurrió con el paquete.");
  if (evidencia) await agregarEvidenciaPnr({ pnr, archivo: evidencia, nota: "Evidencia enviada por el driver" });
  const { data, error } = await supabase.rpc("responder_pnr_flotilla", {
    p_pnr_id: pnr.id,
    p_respuesta: String(respuesta).trim(),
  });
  if (error) throw new Error(error.message || "No fue posible enviar la respuesta.");
  return data;
}

export async function solicitarConvenioPnr({ pnrId, montoSemanal }) {
  const monto = Number(montoSemanal);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error("Escribe cuánto puedes abonar por semana.");
  const { data, error } = await supabase.rpc("solicitar_convenio_pnr_flotilla", {
    p_pnr_id: pnrId,
    p_monto_semanal: monto,
  });
  if (error) throw new Error(error.message || "No fue posible solicitar el convenio.");
  return data;
}

export async function gestionarPnrFlotilla({ pnrId, accion, resolucion = "", monto = null }) {
  const { data, error } = await supabase.rpc("gestionar_pnr_flotilla", {
    p_pnr_id: pnrId,
    p_accion: accion,
    p_resolucion: String(resolucion || "").trim() || null,
    p_monto: monto === "" || monto == null ? null : Number(monto),
  });
  if (error) throw new Error(error.message || "No fue posible actualizar el PNR.");
  return data;
}

export async function aplicarDescuentoPnr({ pnrId, saldo, desde, hasta, monto, observaciones }) {
  const errorValidacion = validarDescuentoPnr({ saldo, monto, desde, hasta });
  if (errorValidacion) throw new Error(errorValidacion);
  const { data, error } = await supabase.rpc("aplicar_descuento_pnr_flotilla", {
    p_pnr_id: pnrId,
    p_periodo_desde: desde,
    p_periodo_hasta: hasta,
    p_monto: Number(monto),
    p_observaciones: String(observaciones || "").trim() || null,
  });
  if (error) throw new Error(error.message || "No fue posible aplicar el descuento semanal.");
  return data;
}

export function suscribirseAPnrFlotilla(onCambio) {
  const canal = supabase.channel(`flotilla-pnr-${Date.now()}`);
  for (const table of ["flotilla_pnr_expedientes", "flotilla_pnr_evidencias", "flotilla_pnr_descuentos"]) {
    canal.on("postgres_changes", { event: "*", schema: "public", table }, (cambio) => {
      if (typeof onCambio === "function") onCambio(cambio);
    });
  }
  canal.subscribe();
  return () => supabase.removeChannel(canal);
}
