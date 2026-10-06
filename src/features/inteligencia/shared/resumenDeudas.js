const ESTADOS_DEUDA_ABIERTA = new Set(["ACTIVA", "REESTRUCTURADA"]);

function numeroONulo(valor) {
  if (valor === "" || valor === null || valor === undefined) {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function calcularResumenDeudas(deudas = []) {
  const abiertas = (Array.isArray(deudas) ? deudas : []).filter((deuda) =>
    ESTADOS_DEUDA_ABIERTA.has(String(deuda?.estado || "").trim().toUpperCase()),
  );

  return abiertas.reduce(
    (resumen, deuda) => {
      const saldo = Number(deuda?.saldo_actual);
      const pago = Number(deuda?.pago_mensual);
      const tasa = numeroONulo(deuda?.tasa_anual);

      return {
        cantidad: resumen.cantidad + 1,
        saldoTotal:
          resumen.saldoTotal + (Number.isFinite(saldo) ? saldo : 0),
        pagoMensualTotal:
          resumen.pagoMensualTotal + (Number.isFinite(pago) ? pago : 0),
        sinTasa: resumen.sinTasa + (tasa === null ? 1 : 0),
        sinPagoMensual:
          resumen.sinPagoMensual +
          (!Number.isFinite(pago) || pago <= 0 ? 1 : 0),
      };
    },
    {
      cantidad: 0,
      saldoTotal: 0,
      pagoMensualTotal: 0,
      sinTasa: 0,
      sinPagoMensual: 0,
    },
  );
}
