export function obtenerEstadoCorte({
  cargando = false,
  error = false,
  fechaInicial = null,
  fechaFinal = null,
} = {}) {
  if (cargando) return "cargando";
  if (error) return "error";
  if (!fechaInicial || !fechaFinal) return "sin-periodo";
  return "listo";
}
