export const TIPOS_INCIDENCIA_FLOTILLA = Object.freeze([
  { value: "ALTO_VALOR", label: "Paquete de alto valor" },
  { value: "PNR", label: "PNR · paquete no recibido" },
  { value: "CEDIS_SIN_ESPACIO", label: "CEDIS sin espacio" },
  { value: "DESCONTENEDORIZADO", label: "Descontenedorizado" },
  { value: "DEVUELTO", label: "Paquete devuelto" },
  { value: "DANO_UNIDAD", label: "Daño en la unidad" },
  { value: "ACCIDENTE", label: "Accidente" },
  { value: "OTRO", label: "Otro" },
]);

export const ESTADOS_INCIDENCIA_FLOTILLA = Object.freeze([
  "PENDIENTE",
  "EN_REVISION",
  "RESUELTA",
  "RECHAZADA",
]);

const TIPOS_CON_PAQUETE = new Set([
  "ALTO_VALOR",
  "PNR",
  "CEDIS_SIN_ESPACIO",
  "DESCONTENEDORIZADO",
  "DEVUELTO",
]);

export function tipoIncidenciaRequierePaquete(tipo) {
  return TIPOS_CON_PAQUETE.has(String(tipo || ""));
}

export function validarNuevaIncidencia({
  rutaId,
  tipo,
  paqueteId,
  descripcion,
  fotoContexto,
  fotoDetalle,
}) {
  const errores = [];
  if (!rutaId) errores.push("Inicia o selecciona una ruta antes de reportar la incidencia.");
  if (!TIPOS_INCIDENCIA_FLOTILLA.some((opcion) => opcion.value === tipo)) {
    errores.push("Selecciona el tipo de incidencia.");
  }
  if (tipoIncidenciaRequierePaquete(tipo) && !String(paqueteId || "").trim()) {
    errores.push("Escribe el ID del paquete.");
  }
  if (String(descripcion || "").trim().length < 8) {
    errores.push("Describe qué ocurrió con al menos 8 caracteres.");
  }
  if (!fotoContexto) errores.push("Adjunta una foto general del contexto.");
  if (!fotoDetalle) errores.push("Adjunta una foto cercana del detalle o etiqueta.");
  return errores;
}

export function validarArchivoIncidencia(archivo) {
  if (!archivo) return "Selecciona una fotografía.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
    return "Usa una fotografía JPG, PNG o WebP.";
  }
  if (archivo.size > 10 * 1024 * 1024) {
    return "Cada fotografía debe pesar máximo 10 MB.";
  }
  return "";
}

export function etiquetaTipoIncidencia(tipo) {
  return TIPOS_INCIDENCIA_FLOTILLA.find((opcion) => opcion.value === tipo)?.label || "Otro";
}
