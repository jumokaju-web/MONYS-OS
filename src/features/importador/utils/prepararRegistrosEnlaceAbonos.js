export function prepararRegistrosEnlaceAbonos(grupos = [], contexto = {}) {
  const { organizationId, businessId, branchId, importacionId, archivoNombre = "Reporte SICAR" } = contexto;
  return (Array.isArray(grupos) ? grupos : []).flatMap((grupo) =>
    (Array.isArray(grupo?.items) ? grupo.items : []).map(({ fila, detalle }) => ({
      organizationId,
      businessId,
      branchId,
      importacionId: detalle.importacion_id,
      detalleId: detalle.id,
      proveedorNombre: fila.proveedorNombre,
      tipoAplicacion: "POR_DETERMINAR",
      fechaPago: fila.fecha,
      importePago: fila.monto,
      evidencia: `Importación de abonos ${importacionId}; archivo ${archivoNombre}; renglón ${fila.codigo}; folio ${fila.folioCheque || "sin folio"}; Caja ${fila.caja}; forma ${fila.metodoPago}; movimiento ${detalle.codigo || `renglón ${detalle.numero_fila}`}; aplicación a factura por confirmar.`.slice(0, 500),
    })),
  );
}
