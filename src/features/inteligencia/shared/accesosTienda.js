export function resolverAccesosTienda({
  responsabilidades = [],
  permisos = [],
} = {}) {
  const responsabilidadesEfectivas = new Set(
    Array.isArray(responsabilidades) ? responsabilidades : [],
  );
  const permisosEfectivos = new Set(
    Array.isArray(permisos) ? permisos : [],
  );

  const participaEnVentaOInventario = [
    "VENTA_TIENDA",
    "VENTA_WHATSAPP",
    "INVENTARIO_APOYO",
  ].some((responsabilidad) =>
    responsabilidadesEfectivas.has(responsabilidad),
  );

  return {
    puedeCaja: responsabilidadesEfectivas.has("CAJA_CORTE"),
    puedeWhatsApp: responsabilidadesEfectivas.has("VENTA_WHATSAPP"),
    puedeRegistrarIncidencias: permisosEfectivos.has("registrar_incidencias"),
    puedeRegistrarProducto:
      participaEnVentaOInventario &&
      permisosEfectivos.has("registrar_producto_solicitado"),
  };
}
