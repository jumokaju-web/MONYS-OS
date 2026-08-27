// ======================================================
// MONYS OS
// Cálculo de métricas reales del Dashboard
// ======================================================

 const convertirNumero = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0;
  }

  if (
    typeof valor === "number"
  ) {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto = String(valor)
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");

  let esNegativo = false;

  if (
    texto.startsWith("(") &&
    texto.endsWith(")")
  ) {
    esNegativo = true;

    texto = texto.slice(
      1,
      -1
    );
  }

  const numero =
    Number(texto);

  if (
    !Number.isFinite(numero)
  ) {
    return 0;
  }

  return esNegativo
    ? numero * -1
    : numero;
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

  const calcularTotalesFinancieros = (
    lista = []
  ) => {
    let ventasCalculadas = 0;
    let costosCalculados = 0;
    let utilidadCalculada = 0;
    let registrosConImporte = 0;

    for (const detalle of lista) {
      const datosOriginales =
        detalle?.datos_originales || {};

      const importe =
        convertirNumero(
          detalle?.importe ??
            datosOriginales.importe ??
            datosOriginales.ventaTotal ??
            datosOriginales.totalVenta ??
            datosOriginales.total
        );

      const costo =
        convertirNumero(
          detalle?.costo ??
            datosOriginales.costo ??
            datosOriginales.costoTotal ??
            datosOriginales.totalCosto
        );

      const utilidad =
        convertirNumero(
          detalle?.utilidad ??
            datosOriginales.utilidad ??
            datosOriginales.utilidadTotal
        );

      if (
        importe !== 0 ||
        costo !== 0 ||
        utilidad !== 0
      ) {
        registrosConImporte += 1;
      }

      ventasCalculadas +=
        importe;

      costosCalculados +=
        costo;

      utilidadCalculada +=
        utilidad;

      const fecha =
        obtenerFechaDetalle(
          detalle
        );

      if (fecha) {
        fechasValidas.push(
          fecha
        );
      }
    }

    return {
      ventasCalculadas,
      costosCalculados,
      utilidadCalculada,
      registrosConImporte,
    };
  };

  const totalesUtilidad =
    calcularTotalesFinancieros(
      utilidadVentas
    );

  if (
    totalesUtilidad
      .registrosConImporte > 0
  ) {
    ventasTotales =
      totalesUtilidad
        .ventasCalculadas;

    costoTotal =
      totalesUtilidad
        .costosCalculados;

    utilidadTotal =
      totalesUtilidad
        .utilidadCalculada;
  } else {
    const totalesVentas =
      calcularTotalesFinancieros(
        ventas
      );

    ventasTotales =
      totalesVentas
        .ventasCalculadas;

    costoTotal =
      totalesVentas
        .costosCalculados;

    utilidadTotal =
      totalesVentas
        .utilidadCalculada;
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