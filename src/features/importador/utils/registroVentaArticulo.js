/*
 * Registro de "Ventas por artículo" para la tabla ventas_articulos.
 *
 * utilidad_disponible / importe_disponible distinguen un cero real de una
 * celda vacía o una columna inexistente (que se guardan como 0). Valores:
 * true = dato del reporte, false = no venía, null = desconocido (filas
 * importadas antes de existir las columnas).
 *
 * Mientras la migración 20261128000000 no esté aplicada, las columnas no
 * existen: el importador detecta ese error y guarda sin ellas, para no
 * romper la importación.
 */
export const COLUMNAS_DISPONIBILIDAD = ["utilidad_disponible", "importe_disponible"];

function bandera(valor) {
  return valor === true ? true : valor === false ? false : null;
}

export function prepararRegistroVentaArticulo(articulo, importacionId, { conBanderas = true } = {}) {
  const registro = {
    importacion_id: importacionId,
    codigo: articulo.codigo || null,
    descripcion: articulo.descripcion,
    categoria: articulo.categoria || null,
    cantidad: articulo.cantidad || 0,
    costo: articulo.costo || 0,
    importe: articulo.importe || 0,
    descuento: articulo.descuento || 0,
    utilidad: articulo.utilidad || 0,
    sucursal: articulo.sucursal || null,
    fecha: articulo.fecha || null,
    folio_venta: articulo.folioVenta || null,
  };
  if (conBanderas) {
    registro.utilidad_disponible = bandera(articulo.utilidadDisponible);
    registro.importe_disponible = bandera(articulo.importeDisponible);
  }
  return registro;
}

/*
 * ¿El error de Supabase/PostgREST se debe a que las columnas de
 * disponibilidad aún no existen? (42703 en Postgres, PGRST204 en el
 * caché de esquema de PostgREST.)
 */
export function esErrorColumnasDisponibilidad(error) {
  const texto = `${error?.code || ""} ${error?.message || error || ""}`;
  return (
    COLUMNAS_DISPONIBILIDAD.some((columna) => texto.includes(columna)) &&
    /42703|PGRST204|does not exist|no existe|schema cache|column/i.test(texto)
  );
}

/*
 * Convierte una fila leída de ventas_articulos al formato que usa el
 * motor de impacto (camelCase). null se conserva: desconocido.
 */
export function leerBanderasVentaArticulo(fila) {
  return {
    ...fila,
    utilidadDisponible: bandera(fila?.utilidad_disponible),
    importeDisponible: bandera(fila?.importe_disponible),
  };
}
