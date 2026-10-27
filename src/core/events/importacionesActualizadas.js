export const EVENTO_IMPORTACIONES_ACTUALIZADAS = "monys:importaciones-actualizadas";

export function notificarImportacionesActualizadas() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return false;
  }

  const evento = typeof CustomEvent === "function"
    ? new CustomEvent(EVENTO_IMPORTACIONES_ACTUALIZADAS)
    : new Event(EVENTO_IMPORTACIONES_ACTUALIZADAS);

  window.dispatchEvent(evento);
  return true;
}
