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
      etiqueta: "Flujo del periodo negativo",
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
      etiqueta: "Salidas elevadas frente a entradas",
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

// El flujo de un periodo no acredita saldos iniciales ni obligaciones.
// Este motor no recibe una disponibilidad conciliada: no puede autorizar compras.
function calcularCapacidadCompra() {
  return null;
}

function crearRecomendacion({ totalEntradas, totalSalidas, balance }) {
  if (totalEntradas === 0 && totalSalidas === 0) {
    return "Registra entradas y salidas para analizar el flujo del periodo. Confirma saldos de bancos, cajas y obligaciones antes de decidir compras.";
  }
  if (balance < 0) {
    return "Las salidas superan a las entradas del periodo. Revisa pagos pendientes y confirma saldos y obligaciones antes de autorizar compras.";
  }
  return "El flujo del periodo es positivo o está equilibrado; no equivale al saldo disponible. La capacidad de compra está por confirmar hasta conciliar bancos, cajas y obligaciones.";
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

  const balance = totalEntradas - totalSalidas;

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

  const planAccion = [
    "Confirmar saldos de bancos y cajas y revisar las obligaciones próximas antes de autorizar compras.",
  ];
  if (balance < 0) {
    planAccion.push("Revisar las salidas que superan a las entradas del periodo.");
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
    flujoNetoTesoreria: balance,
    dineroDisponible: null,
    disponibilidadConfirmada: false,
    planAccion,
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