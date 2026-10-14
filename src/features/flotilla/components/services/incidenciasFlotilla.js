import { supabase } from "../../../../supabase";
import {
  ESTADOS_INCIDENCIA_FLOTILLA,
  validarArchivoIncidencia,
  validarNuevaIncidencia,
} from "../../utils/incidenciasFlotilla";

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

async function subirFoto({ archivo, authUserId, rutaId, incidenciaId, nombre }) {
  const errorArchivo = validarArchivoIncidencia(archivo);
  if (errorArchivo) throw new Error(errorArchivo);

  const path = `${authUserId}/${rutaId}/incidencias/${incidenciaId}/${nombre}.${extensionDeArchivo(archivo)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    cacheControl: "3600",
    contentType: archivo.type,
    upsert: false,
  });
  if (error) throw new Error(error.message || "No fue posible guardar una fotografía.");
  return path;
}

async function crearUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return error ? null : data?.signedUrl || null;
}

export async function registrarIncidenciaFlotilla({
  rutaId,
  codigoRuta,
  tipo,
  paqueteId,
  descripcion,
  detalle = {},
  mensajeWhatsapp,
  fotoContexto,
  fotoDetalle,
  fotosExtra = [],
}) {
  const errores = validarNuevaIncidencia({
    rutaId,
    codigoRuta,
    tipo,
    paqueteId,
    descripcion,
    detalle,
    fotoContexto,
    fotoDetalle,
  });
  if (errores.length) throw new Error(errores[0]);

  for (const archivo of [fotoContexto, fotoDetalle, ...fotosExtra]) {
    const errorArchivo = validarArchivoIncidencia(archivo);
    if (errorArchivo) throw new Error(errorArchivo);
  }
  if (fotosExtra.length > 2) throw new Error("Puedes adjuntar máximo dos fotografías adicionales.");

  const authUser = await obtenerAuthUser();
  const incidenciaId = crypto.randomUUID();
  const paths = [];

  try {
    const fotoContextoPath = await subirFoto({
      archivo: fotoContexto,
      authUserId: authUser.id,
      rutaId,
      incidenciaId,
      nombre: "contexto",
    });
    paths.push(fotoContextoPath);

    const fotoDetallePath = await subirFoto({
      archivo: fotoDetalle,
      authUserId: authUser.id,
      rutaId,
      incidenciaId,
      nombre: "detalle",
    });
    paths.push(fotoDetallePath);

    const fotosExtraPaths = [];
    for (const [indice, archivo] of fotosExtra.entries()) {
      const path = await subirFoto({
        archivo,
        authUserId: authUser.id,
        rutaId,
        incidenciaId,
        nombre: `extra-${indice + 1}`,
      });
      paths.push(path);
      fotosExtraPaths.push(path);
    }

    const { data, error } = await supabase
      .from("flotilla_incidencias")
      .insert({
        id: incidenciaId,
        ruta_id: rutaId,
        tipo,
        paquete_id: String(paqueteId || "").trim() || null,
        descripcion: String(descripcion || "").trim(),
        detalle,
        mensaje_whatsapp: String(mensajeWhatsapp || "").trim(),
        foto_contexto_path: fotoContextoPath,
        foto_detalle_path: fotoDetallePath,
        fotos_extra_paths: fotosExtraPaths,
        client_event_id: `incidencia:${incidenciaId}`,
      })
      .select("id, fecha, estado, created_at")
      .single();

    if (error) throw new Error(error.message || "No fue posible registrar la incidencia.");
    return data;
  } catch (error) {
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    throw error;
  }
}

export async function obtenerIncidenciasFlotilla({ desde, hasta, unidadId = "", estado = "" }) {
  if (!desde || !hasta) throw new Error("Selecciona el periodo de incidencias.");

  let consulta = supabase
    .from("flotilla_incidencias")
    .select(`
      id, ruta_id, unidad_id, driver_auth_user_id, chofer_nombre, fecha,
      tipo, paquete_id, descripcion, detalle, mensaje_whatsapp, foto_contexto_path, foto_detalle_path,
      fotos_extra_paths, estado, resolucion, revisado_at, created_at, updated_at,
      unidad:flotilla_unidades(placas),
      ruta:flotilla_rutas(codigo_ruta, estado)
    `)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("created_at", { ascending: false });

  if (unidadId) consulta = consulta.eq("unidad_id", unidadId);
  if (estado) consulta = consulta.eq("estado", estado);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message || "No fue posible consultar las incidencias.");

  return Promise.all((data || []).map(async (item) => ({
    ...item,
    foto_contexto_url: await crearUrl(item.foto_contexto_path),
    foto_detalle_url: await crearUrl(item.foto_detalle_path),
    fotos_extra_urls: await Promise.all((item.fotos_extra_paths || []).map(crearUrl)),
  })));
}

export async function revisarIncidenciaFlotilla({ incidenciaId, estado, resolucion }) {
  if (!incidenciaId || !ESTADOS_INCIDENCIA_FLOTILLA.includes(estado)) {
    throw new Error("La revisión de la incidencia no es válida.");
  }
  if (["RESUELTA", "RECHAZADA"].includes(estado) && !String(resolucion || "").trim()) {
    throw new Error("Escribe la resolución antes de cerrar la incidencia.");
  }

  const { data, error } = await supabase
    .from("flotilla_incidencias")
    .update({
      estado,
      resolucion: String(resolucion || "").trim() || null,
    })
    .eq("id", incidenciaId)
    .select("id, estado, resolucion, revisado_at, updated_at")
    .single();

  if (error) throw new Error(error.message || "No fue posible guardar la revisión.");
  return data;
}

export function suscribirseAIncidenciasFlotilla(onCambio) {
  const canal = supabase
    .channel(`flotilla-incidencias-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_incidencias" }, (cambio) => {
      if (typeof onCambio === "function") onCambio(cambio);
    })
    .subscribe();
  return () => supabase.removeChannel(canal);
}
