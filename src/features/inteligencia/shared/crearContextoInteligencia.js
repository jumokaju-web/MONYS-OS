function normalizarMonto(valor) {
  const monto = Number(valor);

  if (!Number.isFinite(monto)) {
    return 0;
  }

  return monto;
}

function calcularTotalesMovimientos(
  movimientos = []
) {
  return movimientos.reduce(
    (totales, movimiento) => {
      const estado = String(
        movimiento?.estado || ""
      )
        .trim()
        .toUpperCase();

      if (estado === "CANCELADO") {
        return totales;
      }

      const tipo = String(
        movimiento?.tipo || ""
      )
        .trim()
        .toUpperCase();

      const monto = normalizarMonto(
        movimiento?.monto
      );

      if (tipo === "ENTRADA") {
        totales.entradas += monto;
      }

      if (tipo === "SALIDA") {
        totales.salidas += monto;
      }

      return totales;
    },
    {
      entradas: 0,
      salidas: 0,
    }
  );
}

function crearContextoInteligencia({
  datosDashboard,
  movimientos = [],
}) {
  const metricas =
    datosDashboard?.metricas || {};

  const totales =
    calcularTotalesMovimientos(movimientos);

  const balance =
    totales.entradas - totales.salidas;

  return {
    tieneDatosDashboard:
      Boolean(datosDashboard),

    tieneMetricas:
      Object.keys(metricas).length > 0,

    tieneMovimientos:
      movimientos.length > 0,

    metricas,

    movimientos,

    comercial: {
      totalProductos: normalizarMonto(
        metricas?.totalProductos
      ),

      totalPiezas: normalizarMonto(
        metricas?.totalPiezas
      ),

      productoLider:
        metricas?.productoMasVendido || null,
    },

    financiero: {
      totalEntradas: totales.entradas,
      totalSalidas: totales.salidas,
      balance,
    },

    generadoEn:
      new Date().toISOString(),
  };
}

export {
  crearContextoInteligencia,
  calcularTotalesMovimientos,
};