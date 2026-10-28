function fechaUTC(valor) {
  const texto = valor instanceof Date && !Number.isNaN(valor.getTime())
    ? valor.toISOString().slice(0, 10)
    : String(valor || "").trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  if (!texto) return null;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto
    ? null
    : fecha;
}

export function validarCicloLunesDomingo(fechaInicial, fechaFinal) {
  const inicio = fechaUTC(fechaInicial);
  const fin = fechaUTC(fechaFinal);
  if (!inicio || !fin) {
    return { valido: false, motivo: "Faltan fechas válidas para cerrar la semana." };
  }
  if (inicio.getUTCDay() !== 1 || fin.getUTCDay() !== 0) {
    return {
      valido: false,
      motivo: "El corte semanal debe iniciar en lunes y terminar en domingo.",
    };
  }
  const dias = Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
  if (dias !== 7) {
    return {
      valido: false,
      motivo: "El corte debe incluir exactamente siete días: lunes a domingo.",
    };
  }
  return { valido: true, dias: 7, motivo: "Semana completa de lunes a domingo." };
}
