export function esPerfilGrowth(usuario = {}) {
  const contextoOperativo = [
    usuario?.puesto,
    usuario?.area,
    usuario?.departamento,
    usuario?.department,
    usuario?.unidad,
    usuario?.equipo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  /*
    Cuando existe un puesto o área real de RH, ese dato manda sobre el rol
    técnico. Así una vendedora nunca recibe Growth por una configuración de
    permisos antigua. El rol solo se usa como respaldo para cuentas que aún
    no tienen ficha de empleada vinculada.
  */
  if (contextoOperativo.trim()) {
    return /marketing|growth|crecimiento/.test(contextoOperativo);
  }

  return /marketing|growth|crecimiento/.test(
    String(usuario?.role || "").toLowerCase()
  );
}
