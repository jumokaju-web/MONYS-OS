function convertirNumero(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero;
}

function limitarPuntaje(valor) {
  return Math.max(
    0,
    Math.min(100, Math.round(valor))
  );
}

function calcularSaludVentas({
  ventasTotales,
  utilidadTotal,
  margenUtilidad,
}) {
  if (ventasTotales <= 0) {
    return 0;
  }

  let puntaje = 45;

  if (utilidadTotal > 0) {
    puntaje += 20;
  }

  if (margenUtilidad >= 40) {
    puntaje += 35;
  } else if (margenUtilidad >= 30) {
    puntaje += 28;
  } else if (margenUtilidad >= 20) {
    puntaje += 18;
  } else if (margenUtilidad > 0) {
    puntaje += 8;
  }

  return limitarPuntaje(puntaje);
}

function calcularSaludLiquidez({
  totalEntradas,
  totalSalidas,
  balance,
}) {
  if (
    totalEntradas === 0 &&
    totalSalidas === 0
  ) {
    return 0;
  }

  if (balance < 0) {
    return 15;
  }

  if (totalEntradas <= 0) {
    return 25;
  }

  const porcentajeSalidas =
    (totalSalidas / totalEntradas) * 100;

  if (porcentajeSalidas <= 40) {
    return 100;
  }

  if (porcentajeSalidas <= 65) {
    return 80;
  }

  if (porcentajeSalidas <= 85) {
    return 55;
  }

  return 30;
}

function obtenerEstadoSalud(porcentaje) {
  if (porcentaje >= 85) {
    return {
      nivel: "excelente",
      estado: "Negocio saludable",
      icono: "🟢",
    };
  }

  if (porcentaje >= 70) {
    return {
      nivel: "bueno",
      estado: "Operación estable",
      icono: "🟢",
    };
  }

  if (porcentaje >= 50) {
    return {
      nivel: "atencion",
      estado: "Requiere atención",
      icono: "🟡",
    };
  }

  if (porcentaje > 0) {
    return {
      nivel: "riesgo",
      estado: "Riesgo empresarial",
      icono: "🔴",
    };
  }

  return {
    nivel: "sin-datos",
    estado: "Sin información suficiente",
    icono: "⚪",
  };
}

function crearRecomendacionSalud({
  saludVentas,
  saludLiquidez,
  porcentajeGeneral,
}) {
  if (
    saludVentas === 0 &&
    saludLiquidez === 0
  ) {
    return (
      "Importa información de ventas y registra movimientos " +
      "de Tesorería para calcular la salud real del negocio."
    );
  }

  if (saludLiquidez < 50) {
    return (
      "La prioridad debe ser proteger el efectivo. " +
      "Revisa salidas, pagos próximos y compras no esenciales."
    );
  }

  if (saludVentas < 50) {
    return (
      "La liquidez necesita acompañarse de mejores resultados comerciales. " +
      "Revisa ventas, utilidad y margen."
    );
  }

  if (porcentajeGeneral >= 85) {
    return (
      "El negocio presenta una condición saludable. " +
      "Mantén el control de gastos y aprovecha oportunidades rentables."
    );
  }

  return (
    "La operación se encuentra estable, pero conviene vigilar " +
    "el flujo de efectivo y mantener un margen rentable."
  );
}

function calcularSaludNegocio({
  datosDashboard,
  analisisFinanciero,
}) {
  const metricas =
    datosDashboard?.metricas || {};

  const ventasTotales = convertirNumero(
    metricas?.ventasTotales
  );

  const utilidadTotal = convertirNumero(
    metricas?.utilidadTotal
  );

  const margenUtilidad = convertirNumero(
    metricas?.margenUtilidad
  );

  const totalEntradas = convertirNumero(
    analisisFinanciero?.totalEntradas
  );

  const totalSalidas = convertirNumero(
    analisisFinanciero?.totalSalidas
  );

  const balance = convertirNumero(
    analisisFinanciero?.balance
  );

  const saludVentas = calcularSaludVentas({
    ventasTotales,
    utilidadTotal,
    margenUtilidad,
  });

  const saludLiquidez = calcularSaludLiquidez({
    totalEntradas,
    totalSalidas,
    balance,
  });

  const indicadoresDisponibles = [
    saludVentas,
    saludLiquidez,
  ].filter((puntaje) => puntaje > 0);

  const porcentajeGeneral =
    indicadoresDisponibles.length > 0
      ? limitarPuntaje(
          indicadoresDisponibles.reduce(
            (total, puntaje) =>
              total + puntaje,
            0
          ) / indicadoresDisponibles.length
        )
      : 0;

  const estadoSalud =
    obtenerEstadoSalud(porcentajeGeneral);

  const recomendacion =
    crearRecomendacionSalud({
      saludVentas,
      saludLiquidez,
      porcentajeGeneral,
    });

  return {
    porcentajeGeneral,
    saludVentas,
    saludLiquidez,
    nivel: estadoSalud.nivel,
    estado: estadoSalud.estado,
    icono: estadoSalud.icono,
    recomendacion,
  };
}

export {
  calcularSaludNegocio,
  calcularSaludVentas,
  calcularSaludLiquidez,
  obtenerEstadoSalud,
};