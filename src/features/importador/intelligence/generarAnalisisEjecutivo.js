function formatoDinero(valor) {
  return Number(valor || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
}

function formatoNumero(valor) {
  return Number(valor || 0).toLocaleString("es-MX");
}

function generarAnalisisInventario(resumen) {
  const totalRegistros = Number(
    resumen.totalRegistros || 0
  );

  const articulosDiferentes = Number(
    resumen.articulosDiferentes || 0
  );

  const existenciaTotal = Number(
    resumen.existenciaTotal || 0
  );

  const valorInventario = Number(
    resumen.valorInventario || 0
  );

  const productosConExistencia = Number(
    resumen.productosConExistencia || 0
  );

  const productosAgotados = Number(
    resumen.productosAgotados || 0
  );

  const productosNegativos = Number(
    resumen.productosNegativos || 0
  );

  const porcentajeAgotados =
    articulosDiferentes > 0
      ? (productosAgotados / articulosDiferentes) * 100
      : 0;

  const porcentajeNegativos =
    articulosDiferentes > 0
      ? (productosNegativos / articulosDiferentes) * 100
      : 0;

  let evaluacionInventario = "";
  let nivel = "positivo";

  if (productosNegativos > 0) {
    evaluacionInventario =
      "Se detectaron existencias negativas. Es necesario revisar movimientos, conteos físicos y posibles errores de captura.";
    nivel = "riesgo";
  } else if (porcentajeAgotados >= 20) {
    evaluacionInventario =
      "Existe una proporción elevada de productos agotados. Conviene priorizar una revisión de resurtido.";
    nivel = "advertencia";
  } else {
    evaluacionInventario =
      "El inventario no presenta alertas críticas en este reporte.";
  }

  const productoMayorExistencia =
    resumen.productoMayorExistencia ||
    "Sin información";

  const cantidadMayorExistencia = Number(
    resumen.cantidadMayorExistencia || 0
  );

  return {
    titulo: "Análisis de inventario completado",
    mensaje:
      `Se analizaron ${formatoNumero(
        totalRegistros
      )} registros correspondientes a ${formatoNumero(
        articulosDiferentes
      )} artículos diferentes. ` +
      `El inventario registra ${formatoNumero(
        existenciaTotal
      )} unidades, con un valor total aproximado de ${formatoDinero(
        valorInventario
      )}. ` +
      `${formatoNumero(
        productosConExistencia
      )} productos cuentan con existencia disponible. ` +
      `Se detectaron ${formatoNumero(
        productosAgotados
      )} productos agotados, equivalentes al ${porcentajeAgotados.toFixed(
        1
      )}% de los artículos, y ${formatoNumero(
        productosNegativos
      )} productos con existencia negativa, equivalentes al ${porcentajeNegativos.toFixed(
        1
      )}%. ` +
      `${evaluacionInventario} ` +
      `El producto con mayor existencia es "${productoMayorExistencia}", con ${formatoNumero(
        cantidadMayorExistencia
      )} unidades registradas.`,
    nivel,
  };
}

function generarAnalisisVentas(resumen) {
  const ventaTotal = Number(
    resumen.ventaTotal || 0
  );

  const utilidadTotal = Number(
    resumen.utilidadTotal || 0
  );

  const cantidadTotal = Number(
    resumen.cantidadTotal || 0
  );

  const cantidadProductoLider = Number(
    resumen.cantidadProductoMasVendido || 0
  );

  const margenUtilidad =
    ventaTotal > 0
      ? (utilidadTotal / ventaTotal) * 100
      : 0;

  const participacionProductoLider =
    cantidadTotal > 0
      ? (cantidadProductoLider / cantidadTotal) * 100
      : 0;

  const ventaPromedioPorPieza =
    cantidadTotal > 0
      ? ventaTotal / cantidadTotal
      : 0;

  let evaluacionMargen = "";

  if (margenUtilidad >= 35) {
    evaluacionMargen =
      "El margen de utilidad es saludable para este reporte.";
  } else if (margenUtilidad >= 25) {
    evaluacionMargen =
      "El margen es aceptable, aunque conviene revisar costos y descuentos.";
  } else {
    evaluacionMargen =
      "El margen es bajo. Conviene revisar costos, precios y descuentos.";
  }

  return {
    titulo: "Análisis ejecutivo completado",
    mensaje:
      `Se analizaron ${formatoNumero(
        resumen.totalRegistros
      )} registros correspondientes a ${formatoNumero(
        resumen.articulosDiferentes
      )} artículos diferentes. ` +
      `La venta total fue de ${formatoDinero(
        ventaTotal
      )} y la utilidad calculada fue de ${formatoDinero(
        utilidadTotal
      )}, equivalente a un margen aproximado de ${margenUtilidad.toFixed(
        1
      )}%. ` +
      `${evaluacionMargen} ` +
      `Se vendieron ${formatoNumero(
        cantidadTotal
      )} piezas, con un ingreso promedio de ${formatoDinero(
        ventaPromedioPorPieza
      )} por pieza. ` +
      `El producto líder fue "${
        resumen.productoMasVendido ||
        "Sin información"
      }", con ${formatoNumero(
        cantidadProductoLider
      )} piezas, que representan aproximadamente ${participacionProductoLider.toFixed(
        1
      )}% de todas las unidades vendidas.`,
    nivel:
      margenUtilidad >= 35
        ? "positivo"
        : margenUtilidad >= 25
        ? "advertencia"
        : "riesgo",
  };
}

export function generarAnalisisEjecutivo(resumen) {
  if (!resumen) {
    return {
      titulo: "Sin información",
      mensaje:
        "Todavía no hay datos suficientes para generar un análisis ejecutivo.",
      nivel: "neutral",
    };
  }

  const esInventario =
    Object.prototype.hasOwnProperty.call(
      resumen,
      "existenciaTotal"
    ) ||
    Object.prototype.hasOwnProperty.call(
      resumen,
      "valorInventario"
    );

  if (esInventario) {
    return generarAnalisisInventario(resumen);
  }

  return generarAnalisisVentas(resumen);
}