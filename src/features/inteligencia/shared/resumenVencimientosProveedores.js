function diaUTC(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null;
  }

  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return Math.floor(fecha.getTime() / 86400000);
}

function fechaISOHoy() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function calcularResumenVencimientosProveedores(
  creditos = [],
  fechaReferencia = fechaISOHoy(),
) {
  const diaReferencia = diaUTC(fechaReferencia);
  const registros = (Array.isArray(creditos) ? creditos : [])
    .map((credito) => {
      const saldo = Number(credito?.saldo);
      const diaVencimiento = diaUTC(credito?.fecha_vencimiento);

      return {
        saldo,
        diaVencimiento,
        esSaldoValido: Number.isFinite(saldo) && saldo > 0,
      };
    })
    .filter((credito) => credito.esSaldoValido);

  const calcularHasta = (dias) => {
    if (diaReferencia === null) return 0;
    const limite = diaReferencia + dias;

    return registros.reduce((total, credito) => {
      if (
        credito.diaVencimiento === null ||
        credito.diaVencimiento > limite
      ) {
        return total;
      }

      return total + credito.saldo;
    }, 0);
  };

  const sinFecha = registros.filter(
    (credito) => credito.diaVencimiento === null,
  );

  return {
    vencimientos7Dias: calcularHasta(7),
    vencimientos15Dias: calcularHasta(15),
    vencimientos30Dias: calcularHasta(30),
    vencimientos60Dias: calcularHasta(60),
    vencimientos90Dias: calcularHasta(90),
    saldoSinFecha: sinFecha.reduce(
      (total, credito) => total + credito.saldo,
      0,
    ),
    cantidadSinFecha: sinFecha.length,
  };
}
