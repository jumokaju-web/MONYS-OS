export function titulosSeguimientoCampana(nombre) {
  const limpio = String(nombre || '').trim();
  return limpio ? [`Revisar resultados de campaña: ${limpio}`, `Dar seguimiento a campaña sin avances: ${limpio}`] : [];
}
export function tituloSeguimientoCanonico(titulo) {
  return String(titulo || '').replace(/^Dar seguimiento a campaña sin avances:/, 'Revisar resultados de campaña:');
}
