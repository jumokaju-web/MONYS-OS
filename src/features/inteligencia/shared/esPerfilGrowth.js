export function esPerfilGrowth(usuario = {}) {
  const contextoPuesto = [
    usuario?.puesto,
    usuario?.role,
    usuario?.area,
    usuario?.departamento,
    usuario?.department,
    usuario?.unidad,
    usuario?.equipo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /marketing|growth|crecimiento/.test(contextoPuesto);
}
