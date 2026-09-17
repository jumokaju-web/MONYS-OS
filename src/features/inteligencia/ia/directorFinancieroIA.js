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

const obtenerClaveFecha = (valor) => {
  if (!valor) {
    return null;
  }

  const texto = String(valor).trim();

  const fechaISO = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (fechaISO) {
    return `${fechaISO[1]}-${fechaISO[2]}-${fechaISO[3]}`;
  }

  const fechaLatina = texto.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/
  );

  if (fechaLatina) {
    const dia = fechaLatina[1].padStart(
      2,
      "0"
    );

    const mes = fechaLatina[2].padStart(
      2,
      "0"
    );

    return `${fechaLatina[3]}-${mes}-${dia}`;
  }

  const fecha = convertirFecha(valor);

  if (!fecha) {
    return null;
  }

  const anio = fecha.getFullYear();
  const mes = String(
    fecha.getMonth() + 1
  ).padStart(2, "0");
  const dia = String(
    fecha.getDate()
  ).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
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

  saldoProveedores = 0,
  creditosProveedores = [],
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

  const claveInicioPeriodo =
    obtenerClaveFecha(fechaInicial);

  const claveFinPeriodo =
    obtenerClaveFecha(fechaFinal);

  const hayPeriodoCompleto =
    Boolean(
      claveInicioPeriodo &&
        claveFinPeriodo
    );

    const hoy =
  new Date();

hoy.setHours(
  0,
  0,
  0,
  0
);

const creditosValidos =
  Array.isArray(
    creditosProveedores
  )
    ? creditosProveedores
    : [];

const calcularMontoPorHorizonte =
  (diasHorizonte) => {
    const fechaLimite =
      new Date(hoy);

    fechaLimite.setDate(
      fechaLimite.getDate() +
        diasHorizonte
    );

    return creditosValidos.reduce(
      (
        total,
        credito
      ) => {
        const fechaCredito =
          credito?.fecha_vencimiento_estimada
            ? new Date(
                `${credito.fecha_vencimiento_estimada}T00:00:00`
              )
            : null;

        if (
          !fechaCredito ||
          Number.isNaN(
            fechaCredito.getTime()
          )
        ) {
          return total;
        }

        if (
          fechaCredito <=
          fechaLimite
        ) {
          return (
            total +
            (
              Number(
                credito?.saldo
              ) || 0
            )
          );
        }

        return total;
      },
      0
    );
  };

const vencimientos7Dias =
  calcularMontoPorHorizonte(7);

const vencimientos15Dias =
  calcularMontoPorHorizonte(15);

const vencimientos30Dias =
  calcularMontoPorHorizonte(30);

const vencimientos60Dias =
  calcularMontoPorHorizonte(60);

const vencimientos90Dias =
  calcularMontoPorHorizonte(90);

   const normalizarValor = (
    valor = ""
  ) =>
    String(valor)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase();

  const obtenerTipoMovimiento = (
    movimiento
  ) =>
    normalizarValor(
      movimiento?.tipo ||
        movimiento?.movement_type
    );

  const obtenerEstadoMovimiento = (
    movimiento
  ) =>
    movimiento?.estado ||
    movimiento?.status ||
    "";

  const obtenerCategoriaMovimiento = (
    movimiento
  ) =>
    normalizarValor(
      movimiento?.expense_category ||
        movimiento?.expenseCategory
    );

  const obtenerComportamientoMovimiento =
    (movimiento) =>
      normalizarValor(
        movimiento?.expense_behavior ||
          movimiento?.expenseBehavior
      );

  const obtenerFechaMovimiento = (
    movimiento
  ) =>
    obtenerClaveFecha(
      movimiento?.occurred_at ??
        movimiento?.occurredAt ??
        movimiento?.fechaISO ??
        movimiento?.fecha_iso ??
        movimiento?.fecha
    );

  const movimientoDentroDelPeriodo = (
    movimiento
  ) => {
    if (!hayPeriodoCompleto) {
      return true;
    }

    const claveMovimiento =
      obtenerFechaMovimiento(
        movimiento
      );

    if (!claveMovimiento) {
      return false;
    }

    return (
      claveMovimiento >=
        claveInicioPeriodo &&
      claveMovimiento <=
        claveFinPeriodo
    );
  };

  const movimientosValidos =
    Array.isArray(movimientos)
      ? movimientos.filter(
          (movimiento) => {
            const estado =
              normalizarValor(
                obtenerEstadoMovimiento(
                  movimiento
                )
              );

            return (
              estado !== "cancelado" &&
              movimientoDentroDelPeriodo(
                movimiento
              )
            );
          }
        )
      : [];

  const movimientosPendientes =
    movimientosValidos.filter(
      (movimiento) => {
        const estado =
          obtenerEstadoMovimiento(
            movimiento
          );

        return (
          estado ===
            "Pendiente de revisión" ||
          estado ===
            "En revisión"
        );
      }
    ).length;

  /*
    Los cortes de caja son traspasos internos:
    el dinero cambia de ubicación, pero no sale
    del negocio.
  */
  const esTraspasoInterno = (
    movimiento
  ) =>
    obtenerCategoriaMovimiento(
      movimiento
    ) === "traspaso_caja";

  const entradasTesoreria =
    movimientosValidos
      .filter(
        (movimiento) =>
          obtenerTipoMovimiento(
            movimiento
          ) === "entrada"
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto ??
              movimiento?.amount
          ),
        0
      );

  /*
    Salidas registradas originalmente,
    incluyendo los cortes de caja.
  */
  const salidasTesoreriaBrutas =
    movimientosValidos
      .filter(
        (movimiento) =>
          obtenerTipoMovimiento(
            movimiento
          ) === "salida"
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto ??
              movimiento?.amount
          ),
        0
      );

  const traspasosCaja =
    movimientosValidos
      .filter(
        (movimiento) =>
          obtenerTipoMovimiento(
            movimiento
          ) === "salida" &&
          esTraspasoInterno(
            movimiento
          )
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto ??
              movimiento?.amount
          ),
        0
      );

  /*
    Salidas que realmente abandonaron
    el negocio durante el periodo.
  */
  const salidasTesoreria =
    salidasTesoreriaBrutas -
    traspasosCaja;

  /*
    Por ahora esta cifra representa el flujo
    neto del periodo, no el saldo bancario real.

    Más adelante se conectará con los saldos
    iniciales de caja y bancos.
  */
  const flujoNetoTesoreria =
    entradasTesoreria -
    salidasTesoreria;

  /*
    Se conserva este nombre temporalmente
    para no romper los componentes existentes.
  */
  const dineroDisponible =
    flujoNetoTesoreria;

  /*
    Para calcular gastos operativos solamente
    se usan salidas revisadas y clasificadas
    como fijas o variables.
  */
  const salidasClasificadas =
    movimientosValidos.filter(
      (movimiento) => {
        const tipo =
          obtenerTipoMovimiento(
            movimiento
          );

        const estado =
          obtenerEstadoMovimiento(
            movimiento
          );

        const comportamiento =
          obtenerComportamientoMovimiento(
            movimiento
          );

        return (
          tipo === "salida" &&
          estado === "Revisado" &&
          (
            comportamiento === "fijo" ||
            comportamiento === "variable"
          )
        );
      }
    );

  const gastosFijos =
    salidasClasificadas
      .filter(
        (movimiento) =>
          obtenerComportamientoMovimiento(
            movimiento
          ) === "fijo"
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto ??
              movimiento?.amount
          ),
        0
      );

  const gastosVariables =
    salidasClasificadas
      .filter(
        (movimiento) =>
          obtenerComportamientoMovimiento(
            movimiento
          ) === "variable"
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto ??
              movimiento?.amount
          ),
        0
      );

  const gastosOperativos =
    gastosFijos +
    gastosVariables;

  /*
    Incluye únicamente salidas que todavía
    requieren una decisión humana.
  */
  const gastosSinClasificar =
    movimientosValidos
      .filter(
        (movimiento) => {
          const tipo =
            obtenerTipoMovimiento(
              movimiento
            );

          const estado =
            obtenerEstadoMovimiento(
              movimiento
            );

          return (
            tipo === "salida" &&
            (
              estado ===
                "Pendiente de revisión" ||
              estado ===
                "En revisión"
            )
          );
        }
      )
      .reduce(
        (total, movimiento) =>
          total +
          convertirNumero(
            movimiento?.monto ??
              movimiento?.amount
          ),
        0
      );

  /*
    Los gastos se comparan contra ventas.
    Si todavía no hay ventas, se utilizan
    las entradas de Tesorería como respaldo.
  */
  const basePorcentajeGastos =
    ventas > 0
      ? ventas
      : entradasTesoreria;

  const nombreBasePorcentajeGastos =
    ventas > 0
      ? "las ventas"
      : "las entradas de Tesorería";

  const porcentajeGastos =
    basePorcentajeGastos > 0
      ? (
          gastosOperativos /
          basePorcentajeGastos
        ) * 100
      : 0;

  const utilidadNetaEstimada =
    utilidad -
    gastosOperativos;

  const margenConGastos =
    ventas > 0
      ? (
          utilidadNetaEstimada /
          ventas
        ) * 100
      : 0;

  const margenContribucion =
    ventas > 0
      ? (
          (
            ventas -
            costos -
            gastosVariables
          ) /
          ventas
        )
      : 0;

  const puntoEquilibrioVentas =
    margenContribucion > 0
      ? gastosFijos /
        margenContribucion
      : null;

  const ventasSobrePuntoEquilibrio =
    puntoEquilibrioVentas !== null
      ? ventas -
        puntoEquilibrioVentas
      : null;

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
  )}. Los gastos operativos clasificados representan ${formatoPorcentaje(
    porcentajeGastos
  )} de ${nombreBasePorcentajeGastos}.${
    saldoProveedores > 0
      ? ` Además, existen ${formatoDinero(
          saldoProveedores
        )} registrados como saldo pendiente con proveedores.`
      : ""
  }`;

recomendacion =
  saldoProveedores > 0
    ? vencimientos30Dias > 0
      ? `La operación genera utilidad, pero existen ${formatoDinero(
          vencimientos30Dias
        )} en compromisos con proveedores dentro de los próximos 30 días. Conviene proteger liquidez y evitar nuevas compras que comprometan ese pago.`
      : `La operación genera utilidad y existen ${formatoDinero(
          saldoProveedores
        )} pendientes con proveedores, pero no vencen dentro de los próximos 30 días. Mantén vigilancia sobre los próximos vencimientos.`
    : "La operación genera utilidad, pero conviene cuidar el efectivo y revisar pagos próximos antes de comprometer más dinero.";

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
        )} y flujo neto del periodo de ${formatoDinero(
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
        `Los gastos operativos clasificados representan ${formatoPorcentaje(
          porcentajeGastos
        )} de ${nombreBasePorcentajeGastos}. El flujo neto del periodo es ${formatoDinero(
          dineroDisponible
        )}.`;

      recomendacion =
        "Revisa pagos próximos y conserva una reserva antes de autorizar nuevas compras.";
    } else {
      nivel = "🟢";

      estado =
        "Flujo de efectivo favorable";

      mensaje =
        `Las entradas superan las salidas. El flujo neto del periodo es ${formatoDinero(
          dineroDisponible
        )}.`;

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
    flujoNetoTesoreria > 0
      ? flujoNetoTesoreria * 0.20
      : 0;

  /*
    No se autoriza una capacidad de compra
    hasta conectar saldos reales de cajas y
    bancos, obligaciones confirmadas e
    inventario necesario.
  */
  const capacidadCompra = 0;

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
      `Los gastos operativos clasificados superan el 90% de ${nombreBasePorcentajeGastos}.`
    );
  }

  if (
    movimientosPendientes >= 10
  ) {
    alertasFinancieras.push(
      `Existen ${movimientosPendientes} movimientos pendientes de revisión.`
    );
  }

  if (saldoProveedores > 0) {
  alertasFinancieras.push(
    `Hay $${Number(
      saldoProveedores
    ).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} registrados como saldo pendiente con proveedores.`
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
  vencimientos30Dias > 0
) {
  decisionPrioritaria =
    `Proteger liquidez para cubrir ${formatoDinero(
      vencimientos30Dias
    )} en compromisos con proveedores dentro de los próximos 30 días antes de autorizar nuevas compras.`;
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
      origen: "DIRECTOR_FINANCIERO",
      estado: "PROPUESTA_IA",

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
        `Los gastos operativos clasificados representan ${formatoPorcentaje(
          porcentajeGastos
        )} de ${nombreBasePorcentajeGastos}.`,
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
salidasTesoreriaBrutas,
traspasosCaja,
salidasTesoreria,
flujoNetoTesoreria,
dineroDisponible,
gastosOperativos,

    movimientosPendientes,
    porcentajeGastos,
    gastosFijos,
gastosVariables,
gastosSinClasificar,
utilidadNetaEstimada,
margenConGastos,
margenContribucion:
  margenContribucion * 100,
puntoEquilibrioVentas,
ventasSobrePuntoEquilibrio,

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

    vencimientos7Dias,
    vencimientos15Dias,
    vencimientos30Dias,
    vencimientos60Dias,
    vencimientos90Dias,

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
