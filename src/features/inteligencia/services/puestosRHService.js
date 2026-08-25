const puestosPorTipoNegocio = {
  retail: [
    "Encargada",
    "Vendedora",
    "Cajera",
    "Almacén",
    "Compras",
    "Marketing",
    "Administración",
    "Gerencia",
  ],

  logistica: [
    "Chofer",
    "Auxiliar de ruta",
    "Coordinador logístico",
    "Operaciones",
    "Administración",
    "Gerencia",
  ],

  servicios: [
    "Atención al cliente",
    "Operaciones",
    "Ventas",
    "Administración",
    "Gerencia",
  ],

 general: [
  "Administración",
  "Ventas",
  "Marketing",
  "Operaciones",
  "Gerencia",
  "Otro",
],
};

export function obtenerPuestosRH(
  tipoNegocio = "general"
) {
  const clave =
    String(tipoNegocio || "")
      .trim()
      .toLowerCase();

  return (
    puestosPorTipoNegocio[clave] ||
    puestosPorTipoNegocio.general
  );
}