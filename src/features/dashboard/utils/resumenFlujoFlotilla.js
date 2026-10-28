function textoMovimiento(movimiento) {
  return [
    movimiento?.negocio,
    movimiento?.categoria,
    movimiento?.expense_category,
    movimiento?.concepto,
    movimiento?.concept,
    movimiento?.counterparty,
  ].filter(Boolean).join(" ").toLocaleLowerCase("es-MX");
}

function movimientoCancelado(movimiento) {
  const estado = String(movimiento?.estado || movimiento?.status || "").toLocaleLowerCase("es-MX");
  return estado.includes("cancel") || estado.includes("anulad");
}

function esTraspasoInterno(movimiento) {
  return String(movimiento?.categoria || movimiento?.expense_category || "")
    .toLocaleLowerCase("es-MX").includes("traspaso");
}

export function resumirFlujoFlotilla(movimientos = []) {
  const identificados = (Array.isArray(movimientos) ? movimientos : []).filter((movimiento) =>
    /flotilla|ruta|\beox\b|gasolina|combustible/i.test(textoMovimiento(movimiento))
    && !movimientoCancelado(movimiento),
  );
  const operativos = identificados.filter((movimiento) => !esTraspasoInterno(movimiento));
  const entradas = operativos.reduce((total, movimiento) => {
    const tipo = String(movimiento?.tipo || movimiento?.movement_type || "").toLocaleUpperCase("es-MX");
    const monto = Number(movimiento?.monto ?? movimiento?.amount);
    return tipo === "ENTRADA" && Number.isFinite(monto) ? total + monto : total;
  }, 0);
  const salidas = operativos.reduce((total, movimiento) => {
    const tipo = String(movimiento?.tipo || movimiento?.movement_type || "").toLocaleUpperCase("es-MX");
    const monto = Number(movimiento?.monto ?? movimiento?.amount);
    return tipo === "SALIDA" && Number.isFinite(monto) ? total + monto : total;
  }, 0);

  return {
    entradas,
    salidas,
    neto: Math.round((entradas - salidas + Number.EPSILON) * 100) / 100,
    movimientos: operativos.length,
    traspasosExcluidos: identificados.length - operativos.length,
  };
}
