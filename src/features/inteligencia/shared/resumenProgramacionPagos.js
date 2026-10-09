export function calcularMensualidadesConFecha(deudas = []) {
  const registros = (Array.isArray(deudas) ? deudas : []).filter((deuda) => {
    const estado = String(deuda?.estado || "").trim().toUpperCase();
    const pago = Number(deuda?.pago_mensual);

    return (
      ["ACTIVA", "REESTRUCTURADA"].includes(estado) &&
      Boolean(deuda?.fecha_proximo_pago) &&
      Number.isFinite(pago) &&
      pago > 0
    );
  });

  return {
    cantidad: registros.length,
    montoTotal: registros.reduce(
      (total, deuda) => total + Number(deuda.pago_mensual),
      0,
    ),
  };
}
