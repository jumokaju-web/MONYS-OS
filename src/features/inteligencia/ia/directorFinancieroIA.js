// ======================================================
// MONYS ERP AI
// Motor de Inteligencia Financiera
// directorFinancieroIA.js
// ======================================================

export function generarAnalisisFinanciero({
  movimientos = [],
  ventasTotales = 0,
  costoTotal = 0,
  utilidadTotal = 0,
  margenUtilidad = 0,
}) {
  const movimientosValidos = movimientos.filter(
    (movimiento) =>
      movimiento.estado !== "Cancelado"
  );

  const entradasTesoreria = movimientosValidos
    .filter(
      (movimiento) =>
        movimiento.tipo === "ENTRADA"
    )
    .reduce(
      (total, movimiento) =>
        total + (Number(movimiento.monto) || 0),
      0
    );

  const salidasTesoreria = movimientosValidos
    .filter(
      (movimiento) =>
        movimiento.tipo === "SALIDA"
    )
    .reduce(
      (total, movimiento) =>
        total + (Number(movimiento.monto) || 0),
      0
    );

  const dineroDisponible =
    entradasTesoreria - salidasTesoreria;

  const movimientosPendientes =
    movimientosValidos.filter(
      (movimiento) =>
        movimiento.estado ===
          "Pendiente de revisión" ||
        movimiento.estado === "En revisión"
    ).length;

  const porcentajeGastos =
    entradasTesoreria > 0
      ? (salidasTesoreria / entradasTesoreria) * 100
      : 0;

  let nivel = "🟡";
  let estado = "Información insuficiente";
  let mensaje =
    "Todavía no existen movimientos suficientes para evaluar correctamente el flujo de efectivo.";
  let recomendacion =
    "Registra diariamente todas las entradas y salidas para que el análisis financiero sea confiable.";

  if (movimientosValidos.length > 0) {
    if (dineroDisponible < 0) {
      nivel = "🔴";
      estado = "Flujo de efectivo negativo";
      mensaje =
        "Las salidas registradas son mayores que las entradas. Existe presión sobre la liquidez del negocio.";
      recomendacion =
        "Revisa los gastos recientes, limita compras no urgentes y confirma que todas las entradas hayan sido registradas.";
    } else if (
      entradasTesoreria > 0 &&
      porcentajeGastos >= 80
    ) {
      nivel = "🟡";
      estado = "Liquidez ajustada";
      mensaje =
        "Las salidas representan una parte alta de las entradas registradas.";
      recomendacion =
        "Mantén una reserva de efectivo y revisa los pagos próximos antes de autorizar nuevas compras.";
    } else {
      nivel = "🟢";
      estado = "Flujo de efectivo favorable";
      mensaje =
        "Las entradas registradas son mayores que las salidas y actualmente existe disponibilidad positiva.";
      recomendacion =
        "Conserva el control diario y separa una parte del disponible para pagos, compras e imprevistos.";
    }
  }

  return {
    ventasTotales: Number(ventasTotales) || 0,
    costoTotal: Number(costoTotal) || 0,
    utilidadTotal: Number(utilidadTotal) || 0,
    margenUtilidad: Number(margenUtilidad) || 0,
    entradasTesoreria,
    salidasTesoreria,
    dineroDisponible,
    movimientosPendientes,
    porcentajeGastos,
    nivel,
    estado,
    mensaje,
    recomendacion,
  };
}