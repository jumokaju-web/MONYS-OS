export function importePlaneado(valor) {
  if ((typeof valor === 'string' && valor.trim() === '') || valor === null || valor === undefined || typeof valor === 'boolean') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}
export function calcularFlujo13Semanas({ saldoInicial, semanas = [] }) {
  let saldo = importePlaneado(saldoInicial);
  return Array.from({ length: 13 }, (_, i) => {
    const semana = semanas[i] || {};
    const cobros = importePlaneado(semana.cobros);
    const pagos = importePlaneado(semana.pagos);
    const inicio = saldo;
    const completa = inicio !== null && cobros !== null && pagos !== null;
    saldo = completa ? Math.round((inicio + cobros - pagos) * 100) / 100 : null;
    return { semana: i + 1, inicio, cobros, pagos, saldo, completa, deficit: saldo !== null && saldo < 0 };
  });
}
