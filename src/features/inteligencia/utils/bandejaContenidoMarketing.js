const ESTADOS_POR_VISTA = {
  REVISION: new Set(["PENDIENTE_APROBACION"]),
  TRABAJO: new Set(["BORRADOR", "REQUIERE_AJUSTES", "APROBADA", "PROGRAMADA"]),
  HISTORIAL: new Set(["PUBLICADA", "CANCELADA", "ERROR"]),
};

export function clasificarPublicacionesContenido(publicaciones = [], vista = "REVISION") {
  const estados = ESTADOS_POR_VISTA[vista] || ESTADOS_POR_VISTA.REVISION;
  return (Array.isArray(publicaciones) ? publicaciones : []).filter((publicacion) =>
    estados.has(String(publicacion?.estado || "").toUpperCase())
  );
}

export function validarComentarioDecision(decision, comentario = "") {
  const decisionNormalizada = String(decision || "").toUpperCase();
  const comentarioLimpio = String(comentario || "").trim();

  if (["AJUSTAR", "RECHAZAR"].includes(decisionNormalizada) && comentarioLimpio.length < 5) {
    throw new Error("Explica brevemente qué debe cambiar o por qué se rechaza.");
  }

  return comentarioLimpio;
}
