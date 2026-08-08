// ======================================================
// MONYS OS
// Cálculo de métricas reales del Dashboard
// ======================================================

const convertirNumero = (valor) => {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
};

const convertirFechaExcel = (valor) => {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor;
  }

  const numero = Number(valor);

  if (Number.isFinite(numero) && numero > 20000) {
    const fechaBaseExcel = new Date(Date.UTC(1899, 11, 30));

    const milisegundos =
      numero * 24 * 60 * 60 * 1000;

    const fecha = new Date(
      fechaBaseExcel.getTime() + milisegundos
    );

    return Number.isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

const obtenerFechaDetalle = (detalle) => {
  const datosOriginales =
    detalle?.datos_originales || {};

  return convertirFechaExcel(
    detalle?.fecha ??
      datosOriginales.fecha ??
      datosOriginales.fechaVenta ??
      datosOriginales.fecha_venta
  );
};

export function calcularMetricasDashboard(
  detallesVentas = [],
  detallesUtilidad = []
) {
  const ventas = Array.isArray(detallesVentas)
    ? detallesVentas
    : [];

  const utilidadVentas = Array.isArray(
    detallesUtilidad
  )
    ? detallesUtilidad
    : [];

  let totalPiezas = 0;
  let productoMasVendido = null;
  let cantidadMayor = 0;

  for (const detalle of ventas) {
    const cantidad = convertirNumero(
      detalle?.cantidad ??
        detalle?.datos_originales?.cantidad
    );

    totalPiezas += cantidad;

    if (cantidad > cantidadMayor) {
      cantidadMayor = cantidad;

      productoMasVendido = {
        codigo:
          detalle?.codigo || "",

        descripcion:
          detalle?.descripcion ||
          "Producto sin descripción",

        categoria:
          detalle?.categoria ||
          detalle?.datos_originales?.categoria ||
          "Sin categoría",

        cantidad,
      };
    }
  }

  let ventasTotales = 0;
  let costoTotal = 0;
  let utilidadTotal = 0;

  const fechasValidas = [];

  for (const detalle of utilidadVentas) {
    const datosOriginales =
      detalle?.datos_originales || {};

    const importe = convertirNumero(
      detalle?.importe ??
        datosOriginales.importe ??
        datosOriginales.ventaTotal
    );

    const costo = convertirNumero(
      detalle?.costo ??
        datosOriginales.costo ??
        datosOriginales.costoTotal
    );

    const utilidad = convertirNumero(
      detalle?.utilidad ??
        datosOriginales.utilidad
    );

    ventasTotales += importe;
    costoTotal += costo;
    utilidadTotal += utilidad;

    const fecha =
      obtenerFechaDetalle(detalle);

    if (fecha) {
      fechasValidas.push(fecha);
    }
  }

  const margenUtilidad =
    ventasTotales > 0
      ? (utilidadTotal / ventasTotales) * 100
      : 0;

  let fechaInicial = null;
  let fechaFinal = null;
  let diasAnalizados = 0;
  let ventaPromedioDiaria = 0;
  let utilidadPromedioDiaria = 0;

  if (fechasValidas.length > 0) {
    const tiempos =
      fechasValidas.map(
        (fecha) =>
          new Date(
            fecha.getFullYear(),
            fecha.getMonth(),
            fecha.getDate()
          ).getTime()
      );

    const tiempoInicial =
      Math.min(...tiempos);

    const tiempoFinal =
      Math.max(...tiempos);

    fechaInicial =
      new Date(tiempoInicial);

    fechaFinal =
      new Date(tiempoFinal);

    const diferenciaDias =
      Math.floor(
        (tiempoFinal - tiempoInicial) /
          (24 * 60 * 60 * 1000)
      );

    diasAnalizados =
      diferenciaDias + 1;

    if (diasAnalizados > 0) {
      ventaPromedioDiaria =
        ventasTotales / diasAnalizados;

      utilidadPromedioDiaria =
        utilidadTotal / diasAnalizados;
    }
  }

  return {
    totalPiezas,

    totalProductos:
      ventas.length,

    productoMasVendido,

    ventasTotales,

    costoTotal,

    utilidadTotal,

    margenUtilidad,

    fechaInicial,

    fechaFinal,

    diasAnalizados,

    ventaPromedioDiaria,

    utilidadPromedioDiaria,
  };
}