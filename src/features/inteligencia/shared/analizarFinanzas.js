function limitarPorcentaje(valor) {
  return Math.max(
    0,
    Math.min(100, Math.round(valor))
  );
}

function calcularPorcentajeSalidas({
  totalEntradas,
  totalSalidas,
}) {
  if (totalEntradas <= 0) {
    return totalSalidas > 0 ? 100 : 0;
  }

  return limitarPorcentaje(
    (totalSalidas / totalEntradas) * 100
  );
}

function obtenerNivelRiesgo({
  totalEntradas,
  totalSalidas,
  balance,
}) {
  if (
    totalEntradas === 0 &&
    totalSalidas === 0
  ) {
    return {
      nivel: "sin-datos",
      etiqueta: "Sin información suficiente",
      porcentaje: 50,
    };
  }

  if (balance < 0) {
    return {
      nivel: "critico",
      etiqueta: "Riesgo financiero alto",
      porcentaje: 90,
    };
  }

  const porcentajeSalidas =
    calcularPorcentajeSalidas({
      totalEntradas,
      totalSalidas,
    });

  if (porcentajeSalidas >= 85) {
    return {
      nivel: "alto",
      etiqueta: "Liquidez comprometida",
      porcentaje: 75,
    };
  }

  if (porcentajeSalidas >= 65) {
    return {
      nivel: "medio",
      etiqueta: "Atención al flujo",
      porcentaje: 55,
    };
  }

  return {
    nivel: "bajo",
    etiqueta: "Flujo estable",
    porcentaje: 25,
  };
}

function calcularCapacidadCompra({
  balance,
  nivelRiesgo,
}) {
  if (balance <= 0) {
    return 0;
  }

  const porcentajeDisponible = {
    critico: 0,
    alto: 0.1,
    medio: 0.2,
    bajo: 0.35,
    "sin-datos": 0,
  };

  const factor =
    porcentajeDisponible[
      nivelRiesgo?.nivel
    ] || 0;

  return Math.round(balance * factor);
}

function crearRecomendacion({
  totalEntradas,
  totalSalidas,
  balance,
  nivelRiesgo,
  capacidadCompra,
}) {
  if (
    totalEntradas === 0 &&
    totalSalidas === 0
  ) {
    return (
      "Registra entradas y salidas para que el Director " +
      "Financiero pueda calcular la liquidez real."
    );
  }

  if (balance < 0) {
    return (
      "Las salidas superan a las entradas. " +
      "Detén compras no esenciales y revisa pagos pendientes."
    );
  }

  if (nivelRiesgo.nivel === "alto") {
    return (
      "La mayor parte de los ingresos ya fue utilizada. " +
      "Evita nuevas compras grandes hasta recuperar flujo."
    );
  }

  if (nivelRiesgo.nivel === "medio") {
    return (
      `Mantén las compras nuevas por debajo de $${capacidadCompra.toLocaleString(
        "es-MX"
      )} MXN y revisa los próximos pagos.`
    );
  }

  return (
    `El flujo se encuentra estable. La capacidad estimada ` +
    `de compra es de hasta $${capacidadCompra.toLocaleString(
      "es-MX"
    )} MXN sin comprometer demasiado la liquidez.`
  );
}

function analizarFinanzas(contexto) {
  const financiero =
    contexto?.financiero || {};

  const totalEntradas = Number(
    financiero?.totalEntradas || 0
  );

  const totalSalidas = Number(
    financiero?.totalSalidas || 0
  );

  const balance = Number(
    financiero?.balance || 0
  );

  const porcentajeSalidas =
    calcularPorcentajeSalidas({
      totalEntradas,
      totalSalidas,
    });

  const nivelRiesgo = obtenerNivelRiesgo({
    totalEntradas,
    totalSalidas,
    balance,
  });

  const capacidadCompra =
    calcularCapacidadCompra({
      balance,
      nivelRiesgo,
    });

  const recomendacion =
    crearRecomendacion({
      totalEntradas,
      totalSalidas,
      balance,
      nivelRiesgo,
      capacidadCompra,
    });

    const planAccion = [];

if (balance <= 0) {
  planAccion.push(
    "Detener compras no esenciales."
  );
} else {
  planAccion.push(
    `Comprar mercancía hasta $${capacidadCompra.toLocaleString(
      "es-MX"
    )}.`
  );
}

if (nivelRiesgo.nivel === "alto") {
  planAccion.push(
    "Priorizar liquidez antes de nuevas inversiones."
  );
}

if (nivelRiesgo.nivel === "medio") {
  planAccion.push(
    "Revisar pagos programados para esta semana."
  );
}

if (nivelRiesgo.nivel === "bajo") {
  planAccion.push(
    "Mantener el flujo de efectivo actual."
  );
}

    const saludFinanciera = Math.max(
  0,
  Math.min(
    100,
    Math.round(
      ((balance > 0 ? 40 : 0) +
        (100 - porcentajeSalidas) * 0.4 +
        (100 - nivelRiesgo.porcentaje) * 0.2)
    )
  )
);

  return {
    totalEntradas,
    totalSalidas,
    balance,
    porcentajeSalidas,
    nivelRiesgo,
    capacidadCompra,
    saludFinanciera,
    recomendacion,
  };
}

export {
  analizarFinanzas,
  calcularPorcentajeSalidas,
  obtenerNivelRiesgo,
  calcularCapacidadCompra,
};