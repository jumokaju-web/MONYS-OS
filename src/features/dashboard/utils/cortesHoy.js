import { extraerCapturasFinancieras } from '../../inteligencia/utils/capturasFinancierasEquipo.js';

export function importeCorte(valor) {
  if (!['number', 'string'].includes(typeof valor)) return null;
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function resumirCortesHoy(registros = [], fecha) {
  const unicos = [...new Map(registros.filter(r => r?.id).map(r => [r.id, r])).values()];
  const cortes = extraerCapturasFinancieras(unicos)
    .filter(c => c.tipo === 'caja' && c.cierre.fecha === fecha)
    .map(c => ({ ...c, venta: importeCorte(c.datos.ventaSicar),
      diferencia: importeCorte(c.datos.diferenciaCaja),
      diferenciaVenta: importeCorte(c.datos.diferenciaVenta) }));
  const cajas = new Map();
  for (const corte of cortes) {
    const caja = corte.datos.cajaId;
    if (caja) {
      const clave = `${corte.cierre.branch_id}:${caja}`;
      const grupo = cajas.get(clave) || [];
      grupo.push(String(corte.datos.turnoCaja || '').trim());
      cajas.set(clave, grupo);
    }
  }
  const cajasRepetidas = [...cajas.values()].some((turnos) => {
    if (turnos.length < 2) return false;
    if (turnos.some((turno) => !turno)) return true;
    return new Set(turnos).size !== turnos.length;
  });
  const incompletos = cortes.filter(c => c.datos.registroIncompleto || c.venta === null || c.venta < 0 || !c.datos.cajaId).length;
  const suma = cortes.length && !incompletos && !cajasRepetidas
    ? Math.round(cortes.reduce((total, c) => total + c.venta, 0) * 100) / 100 : null;
  return { cortes, ventaReportada: suma, cajasRepetidas, incompletos,
    diferenciasPendientes: cortes.filter(c => c.diferencia === null || c.diferenciaVenta === null).length,
    conDiferencias: cortes.filter(c => (c.diferencia !== null && Math.abs(c.diferencia) >= .01)
      || (c.diferenciaVenta !== null && Math.abs(c.diferenciaVenta) >= .01)).length };
}
