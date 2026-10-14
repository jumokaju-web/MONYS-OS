export const TIPOS_INCIDENCIA_FLOTILLA = Object.freeze([
  { value: "PARADA_FALLIDA", label: "Parada fallida" },
  { value: "ALTO_VALOR", label: "Entrega de alto valor" },
  { value: "RETORNO_PENDIENTE", label: "Paquete por retornar a CEDIS" },
  { value: "RETORNO_CEDIS", label: "Retorno confirmado en CEDIS" },
  { value: "PNR", label: "PNR · paquete no recibido" },
  { value: "CEDIS_SIN_ESPACIO", label: "CEDIS sin espacio" },
  { value: "DESCONTENEDORIZADO", label: "Descontenedorizado" },
  { value: "DEVUELTO", label: "Paquete devuelto · registro anterior" },
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
  "RETORNO_PENDIENTE",
  "RETORNO_CEDIS",
  "PNR",
  "CEDIS_SIN_ESPACIO",
  "DESCONTENEDORIZADO",
  "DEVUELTO",
]);

const CAMPOS_POR_TIPO = Object.freeze({
  PARADA_FALLIDA: ["motivo", "tipoDomicilio", "numeroVisita"],
  ALTO_VALOR: ["parentescoRecibe"],
  RETORNO_PENDIENTE: ["motivo"],
  RETORNO_CEDIS: ["recibeCedis"],
});

export const EVIDENCIAS_POR_TIPO = Object.freeze({
  PARADA_FALLIDA: ["Captura de la parada", "Foto del domicilio con ubicación"],
  ALTO_VALOR: ["Foto de entrega con quien recibe", "Detalle de etiqueta o identificación"],
  RETORNO_PENDIENTE: ["Foto del paquete por retornar", "Detalle de etiqueta e ID"],
  RETORNO_CEDIS: ["Foto del paquete en CEDIS", "Detalle de etiqueta e ID"],
});

function limpiar(valor) {
  return String(valor || "").trim();
}

export function tipoIncidenciaRequierePaquete(tipo) {
  return TIPOS_CON_PAQUETE.has(limpiar(tipo));
}

export function camposRequeridosPorTipo(tipo) {
  return CAMPOS_POR_TIPO[limpiar(tipo)] || [];
}

export function etiquetasEvidenciaPorTipo(tipo) {
  return EVIDENCIAS_POR_TIPO[limpiar(tipo)] || ["Foto general del contexto", "Foto cercana del detalle o etiqueta"];
}

export function generarMensajeReporte({ codigoRuta, tipo, paqueteId, descripcion, detalle = {} }) {
  const ruta = limpiar(codigoRuta);
  const paquete = limpiar(paqueteId);

  if (tipo === "PARADA_FALLIDA") {
    return `Ruta ${ruta} · Parada fallida · ${limpiar(detalle.motivo)} · Marcado como ${limpiar(detalle.tipoDomicilio)} · Visita ${limpiar(detalle.numeroVisita)}.`;
  }
  if (tipo === "ALTO_VALOR") {
    return `Ruta ${ruta} · Alto valor · Recibe ${limpiar(detalle.parentescoRecibe)} · ID ${paquete}.`;
  }
  if (tipo === "RETORNO_PENDIENTE") {
    return `Ruta ${ruta} · Paquete por retornar a CEDIS · ID ${paquete} · Motivo: ${limpiar(detalle.motivo)}.`;
  }
  if (tipo === "RETORNO_CEDIS") {
    return `Ruta ${ruta} · Retorno a CEDIS · ID ${paquete} · Recibe ${limpiar(detalle.recibeCedis)}.`;
  }

  const texto = limpiar(descripcion);
  return `Ruta ${ruta} · ${etiquetaTipoIncidencia(tipo)}${paquete ? ` · ID ${paquete}` : ""}${texto ? ` · ${texto}` : ""}.`;
}

export function validarNuevaIncidencia({ rutaId, codigoRuta, tipo, paqueteId, descripcion, detalle = {}, fotoContexto, fotoDetalle }) {
  const errores = [];
  if (!rutaId) errores.push("Inicia o selecciona una ruta antes de reportar la incidencia.");
  if (!limpiar(codigoRuta)) errores.push("La ruta debe tener un código antes de crear el reporte.");
  if (!TIPOS_INCIDENCIA_FLOTILLA.some((opcion) => opcion.value === tipo)) {
    errores.push("Selecciona el tipo de incidencia.");
  }
  if (tipoIncidenciaRequierePaquete(tipo) && !limpiar(paqueteId)) {
    errores.push("Escribe el ID del paquete.");
  }

  const mensajesCampo = {
    motivo: "Escribe el motivo.",
    tipoDomicilio: "Indica si estaba marcado como residencial o negocio.",
    numeroVisita: "Selecciona el número de visita.",
    parentescoRecibe: "Escribe quién recibe el paquete de alto valor.",
    recibeCedis: "Escribe el nombre de quien recibe el paquete en CEDIS.",
  };
  for (const campo of camposRequeridosPorTipo(tipo)) {
    if (!limpiar(detalle[campo])) errores.push(mensajesCampo[campo]);
  }

  if (!CAMPOS_POR_TIPO[tipo] && limpiar(descripcion).length < 8) {
    errores.push("Describe qué ocurrió con al menos 8 caracteres.");
  }
  const [etiquetaContexto, etiquetaDetalle] = etiquetasEvidenciaPorTipo(tipo);
  if (!fotoContexto) errores.push(`Adjunta: ${etiquetaContexto}.`);
  if (!fotoDetalle) errores.push(`Adjunta: ${etiquetaDetalle}.`);
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
