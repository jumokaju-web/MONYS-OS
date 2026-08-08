// ======================================================
// MONYS OS
// Motor de Inteligencia Financiera
// directorFinancieroIA.js
// ======================================================

const convertirNumero = (valor) => {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
};

const formatoDinero = (cantidad) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(convertirNumero(cantidad));

const formatoPorcentaje = (cantidad) =>
  `${convertirNumero(cantidad).toFixed(2)}%`;

const convertirFecha = (valor) => {
  if (!valor) {
    return null;
  }

  const fecha =
    valor instanceof Date
      ? valor
      : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

export function generarAnalisisFinanciero({
  movimientos = [],

  ventasTotales = 0,
  costoTotal = 0,
  utilidadTotal = 0,
  margenUtilidad = 0,

  fechaInicial = null,
  fechaFinal = null,
  diasAnalizados = 0,

  ventaPromedioDiaria = 0,
  utilidadPromedioDiaria = 0,
}) {
  const ventas =
    convertirNumero(ventasTotales);

  const costos =
    convertirNumero(costoTotal);

  const utilidad =
    convertirNumero(utilidadTotal);

  const margen =
    convertirNumero(margenUtilidad);

  const dias =
    convertirNumero(diasAnalizados);

  const promedioVenta =
    convertirNumero(ventaPromedioDiaria);

  const promedioUtilidad =
    convertirNumero(utilidadPromedioDiaria);

  const inicio =
    convertirFecha(fechaInicial);

  const fin =
    convertirFecha(fechaFinal);

  const movimientosValidos =
    Array.isArray(movimientos)
      ? movimientos.filter(
          (movimiento) =>
            movimiento?.estado !== "Cancelado"
        )
      : [];

  const entradasTesoreria =
    movimientosValidos
      .filter(
        (movimiento) =>
          movimiento?.tipo === "ENTRADA"
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto
          ),
        0
      );

  const salidasTesoreria =
    movimientosValidos
      .filter(
        (movimiento) =>
          movimiento?.tipo === "SALIDA"
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto
          ),
        0
      );

  const dineroDisponible =
    entradasTesoreria -
    salidasTesoreria;

  const movimientosPendientes =
    movimientosValidos.filter(
      (movimiento) =>
        movimiento?.estado ===
          "Pendiente de revisión" ||
        movimiento?.estado ===
          "En revisión"
    ).length;

  const porcentajeGastos =
    entradasTesoreria > 0
      ? (
          salidasTesoreria /
          entradasTesoreria
        ) * 100
      : 0;

  const tieneDatosVentas =
    ventas > 0 ||
    costos > 0 ||
    utilidad !== 0;

  const tieneDatosTesoreria =
    movimientosValidos.length > 0;

  let nivel = "🟡";
  let estado = "Información insuficiente";

  let mensaje =
    "Todavía falta información para realizar un diagnóstico financiero completo.";

  let recomendacion =
    "Continúa registrando movimientos e importando reportes para fortalecer el análisis financiero.";

  // ======================================================
  // DIAGNÓSTICO
  // ======================================================

  if (
    dineroDisponible < 0 ||
    utilidad < 0
  ) {
    nivel = "🔴";
    estado =
      "Atención financiera requerida";

    const problemas = [];

    if (dineroDisponible < 0) {
      problemas.push(
        `el flujo de Tesorería presenta un saldo negativo de ${formatoDinero(
          dineroDisponible
        )}`
      );
    }

    if (utilidad < 0) {
      problemas.push(
        `la operación presenta una pérdida de ${formatoDinero(
          Math.abs(utilidad)
        )}`
      );
    }

    mensaje =
      `Se detectó una situación que requiere revisión: ${problemas.join(
        " y "
      )}.`;

    recomendacion =
      "Revisa gastos, pagos pendientes, costos y movimientos de efectivo antes de autorizar nuevas salidas importantes.";
  } else if (
    tieneDatosVentas &&
    tieneDatosTesoreria
  ) {
    if (porcentajeGastos >= 80) {
      nivel = "🟡";

      estado =
        "Rentabilidad positiva con liquidez ajustada";

      mensaje =
        `Las ventas analizadas suman ${formatoDinero(
          ventas
        )}, con utilidad de ${formatoDinero(
          utilidad
        )} y margen de ${formatoPorcentaje(
          margen
        )}. Las salidas representan ${formatoPorcentaje(
          porcentajeGastos
        )} de las entradas de Tesorería.`;

      recomendacion =
        "La operación genera utilidad, pero conviene cuidar el efectivo y revisar pagos próximos antes de comprometer más dinero.";
    } else if (
      margen > 0 &&
      dineroDisponible >= 0
    ) {
      nivel = "🟢";

      estado =
        "Operación rentable y flujo positivo";

      mensaje =
        `MONYS OS detecta ventas por ${formatoDinero(
          ventas
        )}, costos por ${formatoDinero(
          costos
        )}, utilidad de ${formatoDinero(
          utilidad
        )} y margen de ${formatoPorcentaje(
          margen
        )}.`;

      recomendacion =
        "Mantén el control de efectivo y prioriza las próximas compras con base en rotación, margen e inventario disponible.";
    } else {
      nivel = "🟡";

      estado =
        "Operación estable en revisión";

      mensaje =
        `Se registran ventas por ${formatoDinero(
          ventas
        )}, margen de ${formatoPorcentaje(
          margen
        )} y saldo de Tesorería de ${formatoDinero(
          dineroDisponible
        )}.`;

      recomendacion =
        "Revisa costos, descuentos y rentabilidad antes de aumentar compras o gastos.";
    }
  } else if (tieneDatosVentas) {
    nivel =
      utilidad >= 0
        ? "🟢"
        : "🔴";

    estado =
      utilidad >= 0
        ? "Ventas rentables"
        : "Ventas con pérdida";

    mensaje =
      `SICAR muestra ventas por ${formatoDinero(
        ventas
      )}, costos por ${formatoDinero(
        costos
      )}, utilidad de ${formatoDinero(
        utilidad
      )} y margen de ${formatoPorcentaje(
        margen
      )}.`;

    recomendacion =
      "Continúa registrando Tesorería para relacionar rentabilidad con dinero realmente disponible.";
  } else if (tieneDatosTesoreria) {
    if (porcentajeGastos >= 80) {
      nivel = "🟡";

      estado =
        "Liquidez ajustada";

      mensaje =
        `Las salidas representan ${formatoPorcentaje(
          porcentajeGastos
        )} de las entradas y quedan ${formatoDinero(
          dineroDisponible
        )} disponibles.`;

      recomendacion =
        "Revisa pagos próximos y conserva una reserva antes de autorizar nuevas compras.";
    } else {
      nivel = "🟢";

      estado =
        "Flujo de efectivo favorable";

      mensaje =
        `Las entradas superan las salidas. Actualmente existen ${formatoDinero(
          dineroDisponible
        )} disponibles según Tesorería.`;

      recomendacion =
        "Mantén el registro diario y completa los reportes de SICAR.";
    }
  }

  if (movimientosPendientes > 0) {
    mensaje +=
      ` Además, existen ${movimientosPendientes} movimientos pendientes de revisión.`;
  }

  // ======================================================
  // PERIODO REAL ANALIZADO
  // ======================================================

  let diasDelMesReferencia = 0;

  if (fin) {
    diasDelMesReferencia =
      new Date(
        fin.getFullYear(),
        fin.getMonth() + 1,
        0
      ).getDate();
  }

  const periodoValido =
    dias > 0 &&
    promedioVenta > 0 &&
    diasDelMesReferencia > 0;

  const proyeccionVentasMes =
    periodoValido
      ? promedioVenta *
        diasDelMesReferencia
      : 0;

  const proyeccionUtilidadMes =
    periodoValido
      ? promedioUtilidad *
        diasDelMesReferencia
      : 0;

  const periodoAnalizado =
    inicio && fin
      ? {
          fechaInicial: inicio,
          fechaFinal: fin,
          diasAnalizados: dias,
          ventaPromedioDiaria:
            promedioVenta,
          utilidadPromedioDiaria:
            promedioUtilidad,
          diasDelMes:
            diasDelMesReferencia,
        }
      : null;

  // ======================================================
  // RESERVA Y CAPACIDAD DE COMPRA
  // ======================================================

  const reservaRecomendada =
    dineroDisponible > 0
      ? dineroDisponible * 0.20
      : 0;

  const disponibleDespuesReserva =
    Math.max(
      0,
      dineroDisponible -
        reservaRecomendada
    );

  const limiteCompraPorUtilidad =
    Math.max(
      0,
      utilidad * 0.40
    );

  const capacidadCompra =
    Math.min(
      disponibleDespuesReserva,
      limiteCompraPorUtilidad
    );

  // ======================================================
  // ALERTAS
  // ======================================================

  const alertasFinancieras = [];

  if (dineroDisponible < 0) {
    alertasFinancieras.push(
      "El flujo de efectivo está en negativo."
    );
  }

  if (
    margen > 0 &&
    margen < 25
  ) {
    alertasFinancieras.push(
      "El margen de utilidad está por debajo del 25%."
    );
  }

  if (porcentajeGastos >= 90) {
    alertasFinancieras.push(
      "Las salidas están consumiendo más del 90% de las entradas registradas."
    );
  }

  if (
    movimientosPendientes >= 10
  ) {
    alertasFinancieras.push(
      `Existen ${movimientosPendientes} movimientos pendientes de revisión.`
    );
  }

  if (!periodoValido && ventas > 0) {
    alertasFinancieras.push(
      "No fue posible determinar con seguridad el periodo del reporte; la proyección mensual permanece desactivada."
    );
  }

  // ======================================================
  // DECISIÓN PRIORITARIA
  // ======================================================

  let decisionPrioritaria =
    "Mantener el control financiero y continuar alimentando MONYS OS.";

  if (dineroDisponible < 0) {
    decisionPrioritaria =
      "Prioridad máxima: recuperar liquidez y revisar salidas antes de autorizar nuevas compras.";
  } else if (
    porcentajeGastos >= 90
  ) {
    decisionPrioritaria =
      "Reducir o posponer gastos no prioritarios antes de comprometer más efectivo.";
  } else if (
    capacidadCompra > 0
  ) {
    decisionPrioritaria =
      `La capacidad de compra sugerida es ${formatoDinero(
        capacidadCompra
      )}, conservando una reserva aproximada de ${formatoDinero(
        reservaRecomendada
      )}.`;
  } else if (utilidad > 0) {
    decisionPrioritaria =
      "La operación es rentable, pero conviene conservar efectivo hasta integrar inventario y pagos próximos.";
  }

  // ======================================================
  // ACCIONES PRIORITARIAS DEL DÍA
  // ======================================================

  const accionesPrioritarias = [];

  const agregarAccion = ({
    prioridad,
    titulo,
    descripcion,
    impacto,
    responsable = "Director Financiero",
  }) => {
    accionesPrioritarias.push({
      prioridad,
      titulo,
      descripcion,
      impacto,
      responsable,
    });
  };

  if (dineroDisponible < 0) {
    agregarAccion({
      prioridad: "CRITICA",
      titulo: "Recuperar liquidez",
      descripcion:
        `El flujo disponible está en ${formatoDinero(
          dineroDisponible
        )}. Revisa cobros pendientes y detén salidas no indispensables.`,
      impacto: "ALTO",
    });
  }

  if (porcentajeGastos >= 90) {
    agregarAccion({
      prioridad: "ALTA",
      titulo: "Frenar gastos no prioritarios",
      descripcion:
        `Las salidas representan ${formatoPorcentaje(
          porcentajeGastos
        )} de las entradas registradas.`,
      impacto: "ALTO",
    });
  }

  if (movimientosPendientes > 0) {
    agregarAccion({
      prioridad:
        movimientosPendientes >= 10
          ? "ALTA"
          : "MEDIA",
      titulo: "Revisar movimientos pendientes",
      descripcion:
        `Hay ${movimientosPendientes} movimientos que todavía requieren revisión.`,
      impacto: "MEDIO",
    });
  }

  if (
    capacidadCompra > 0 &&
    porcentajeGastos < 90
  ) {
    agregarAccion({
      prioridad: "MEDIA",
      titulo: "Definir compras autorizables",
      descripcion:
        `Existe una capacidad de compra sugerida de hasta ${formatoDinero(
          capacidadCompra
        )}, siempre conservando la reserva recomendada.`,
      impacto: "ALTO",
    });
  }

  if (reservaRecomendada > 0) {
    agregarAccion({
      prioridad: "MEDIA",
      titulo: "Proteger reserva de efectivo",
      descripcion:
        `Mantén aproximadamente ${formatoDinero(
          reservaRecomendada
        )} sin comprometer para proteger la liquidez.`,
      impacto: "ALTO",
    });
  }

  if (
    margen >= 35 &&
    utilidad > 0
  ) {
    agregarAccion({
      prioridad: "BAJA",
      titulo: "Conservar margen rentable",
      descripcion:
        `El margen actual es ${formatoPorcentaje(
          margen
        )}. Evita descuentos o compras que reduzcan innecesariamente esta rentabilidad.`,
      impacto: "MEDIO",
    });
  }

  if (periodoValido && dias < 10) {
    agregarAccion({
      prioridad: "BAJA",
      titulo: "Tomar la proyección con cautela",
      descripcion:
        `La proyección mensual utiliza solo ${dias} días reales de información. Debe fortalecerse con más días antes de tomar decisiones grandes.`,
      impacto: "MEDIO",
    });
  }

  if (accionesPrioritarias.length === 0) {
    agregarAccion({
      prioridad: "BAJA",
      titulo: "Mantener control financiero",
      descripcion:
        "No se detecta una acción financiera urgente con la información disponible.",
      impacto: "BAJO",
    });
  }

  const ordenPrioridad = {
    CRITICA: 1,
    ALTA: 2,
    MEDIA: 3,
    BAJA: 4,
  };

  accionesPrioritarias.sort(
    (a, b) =>
      ordenPrioridad[a.prioridad] -
      ordenPrioridad[b.prioridad]
  );

  const accionesPrioritariasTop =
    accionesPrioritarias.slice(0, 5);

  return {
    ventasTotales: ventas,
    costoTotal: costos,
    utilidadTotal: utilidad,
    margenUtilidad: margen,

    entradasTesoreria,
    salidasTesoreria,
    dineroDisponible,

    movimientosPendientes,
    porcentajeGastos,

    fechaInicial: inicio,
    fechaFinal: fin,
    diasAnalizados: dias,

    ventaPromedioDiaria:
      promedioVenta,

    utilidadPromedioDiaria:
      promedioUtilidad,

    periodoAnalizado,

    proyeccionVentasMes,
    proyeccionUtilidadMes,

    reservaRecomendada,
    capacidadCompra,

    alertasFinancieras,
    decisionPrioritaria,

    accionesPrioritarias:
      accionesPrioritariasTop,

    nivel,
    estado,
    mensaje,
    recomendacion,
  };
}