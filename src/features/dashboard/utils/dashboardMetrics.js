// ======================================================
// MONYS ERP AI
// Cálculo de métricas del Dashboard
// ======================================================

export function calcularMetricasDashboard(detalles = []) {
  /*
    Si no existen registros, devolvemos todas
    las métricas inicializadas correctamente.
  */
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return {
      totalPiezas: 0,
      totalProductos: 0,
      productoMasVendido: null,
      ventasTotales: 0,
      costoTotal: 0,
      utilidadTotal: 0,
      margenUtilidad: 0,
    };
  }

  let totalPiezas = 0;
  let productoMasVendido = null;
  let cantidadMayor = 0;

  let ventasTotales = 0;
  let costoTotal = 0;
  let utilidadTotal = 0;

  detalles.forEach((detalle) => {
    const cantidad =
      Number(detalle?.cantidad) || 0;

    const datosOriginales =
      detalle?.datos_originales || {};

    const importe =
      Number(datosOriginales.importe) || 0;

    const costoUnitario =
      Number(datosOriginales.costo) || 0;

    const utilidad =
      Number(datosOriginales.utilidad) || 0;

    totalPiezas += cantidad;
    ventasTotales += importe;
    costoTotal += costoUnitario * cantidad;
    utilidadTotal += utilidad;

    if (cantidad > cantidadMayor) {
      cantidadMayor = cantidad;

      productoMasVendido = {
        codigo: detalle?.codigo || "",
        descripcion:
          detalle?.descripcion ||
          "Producto sin descripción",
        categoria:
          detalle?.categoria ||
          "Sin categoría",
        cantidad,
      };
    }
  });

  const margenUtilidad =
    ventasTotales > 0
      ? (utilidadTotal / ventasTotales) * 100
      : 0;

  return {
    totalPiezas,
    totalProductos: detalles.length,
    productoMasVendido,
    ventasTotales,
    costoTotal,
    utilidadTotal,
    margenUtilidad,
  };
}