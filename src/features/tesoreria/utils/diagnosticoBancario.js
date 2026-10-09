import { validarEstadoBancario } from './validarEstadoBancario.js';
const cents = n => Math.round(Number(n) * 100);
export function diagnosticoBancario(paquete, cuenta = '') {
  validarEstadoBancario(paquete);
  const filas = paquete.movimientos.filter(m => !cuenta || m.cuenta === cuenta);
  const confirmados = filas.filter(m => m.revision?.estado === 'Confirmado');
  const pendientes = filas.filter(m => m.revision?.estado !== 'Confirmado');
  const grupos = new Map();
  for (const m of confirmados) {
    const nombre = m.revision.clasificacion;
    const grupo = grupos.get(nombre) || { nombre, movimientos: 0, cargos: 0, abonos: 0 };
    grupo.movimientos++; grupo.cargos += cents(m.cargo); grupo.abonos += cents(m.abono); grupos.set(nombre, grupo);
  }
  const valor = m => cents(m.cargo) + cents(m.abono);
  const total = filas.reduce((s, m) => s + valor(m), 0);
  const revisado = confirmados.reduce((s, m) => s + valor(m), 0);
  const desglosar = filas.filter(m => ['PAGO TARJETA DE CREDITO', 'COBRO AUTOMATICO RECIBO'].includes(m.descripcion));
  return {
    total: filas.length, confirmados: confirmados.length, pendientes: pendientes.length,
    coberturaImporte: total ? Math.round(revisado / total * 100) : 0,
    importePendiente: (total - revisado) / 100,
    grupos: [...grupos.values()].map(g => ({ ...g, cargos: g.cargos / 100, abonos: g.abonos / 100 })).sort((a, b) => (b.cargos + b.abonos) - (a.cargos + a.abonos)),
    mayoresPendientes: [...pendientes].sort((a, b) => valor(b) - valor(a)).slice(0, 5),
    pagosPorDesglosar: desglosar.reduce((s, m) => s + cents(m.cargo), 0) / 100,
    pagosPorDesglosarCantidad: desglosar.length,
  };
}
