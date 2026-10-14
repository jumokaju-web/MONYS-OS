function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function centavos(valor) {
  return Math.round(numero(valor) * 100) / 100;
}

export function saldoPorRecuperarMovimiento(movimiento = {}) {
  if (!["ANTICIPO", "PRESTAMO"].includes(movimiento.tipo) || movimiento.estado !== "PAGADO") return 0;
  const recuperado = (movimiento.recuperaciones || [])
    .filter((item) => item.estado !== "ANULADA")
    .reduce((suma, item) => suma + numero(item.monto), 0);
  return centavos(Math.max(0, numero(movimiento.monto) - recuperado));
}

export function resumirPagosRH(movimientos = []) {
  const lista = Array.isArray(movimientos) ? movimientos : [];
  return lista.reduce((resumen, movimiento) => {
    const monto = numero(movimiento?.monto);
    if (movimiento?.estado === "PENDIENTE") resumen.pendienteAutorizar += monto;
    if (movimiento?.estado === "PAGADO" && movimiento?.tipo === "NOMINA") resumen.nominaPagada += monto;
    if (movimiento?.estado === "PAGADO" && movimiento?.tipo === "COMISION") resumen.comisionesPagadas += monto;
    resumen.porRecuperar += saldoPorRecuperarMovimiento(movimiento);
    resumen.pendienteAutorizar = centavos(resumen.pendienteAutorizar);
    resumen.nominaPagada = centavos(resumen.nominaPagada);
    resumen.comisionesPagadas = centavos(resumen.comisionesPagadas);
    resumen.porRecuperar = centavos(resumen.porRecuperar);
    return resumen;
  }, { pendienteAutorizar: 0, nominaPagada: 0, comisionesPagadas: 0, porRecuperar: 0 });
}
