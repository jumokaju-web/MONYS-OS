export const SECCIONES_COMPRA_MAESTRA = [
  "resumen",
  "compra",
  "traspasos",
  "historial",
];

export function cambiarSeccionCompraMaestra({
  seccion,
  actualizar,
  enfocar,
  programar = (accion) => requestAnimationFrame(accion),
}) {
  if (!SECCIONES_COMPRA_MAESTRA.includes(seccion)) return false;
  if (typeof actualizar !== "function") return false;

  actualizar(seccion);
  programar(() => programar(() => enfocar?.()));
  return true;
}
