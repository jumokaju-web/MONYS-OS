/** Conserva el dato de cantidad solo cuando el reporte realmente lo proporciona.
 * Si se omite, PostgreSQL aplica el DEFAULT de la tabla (0) en lugar de recibir null.
 */
export function prepararDetalleImportacion(fila, indice, importacionId) {
  const detalle = {
    importacion_id: importacionId,
    numero_fila: indice + 1,
    codigo: fila.codigo,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    datos_originales: fila,
  };
  if (fila.cantidad !== undefined && fila.cantidad !== null && fila.cantidad !== "") {
    detalle.cantidad = fila.cantidad;
  }
  return detalle;
}
