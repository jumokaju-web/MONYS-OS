const centavos = (valor) => {
  if (typeof valor !== 'string' || !/^\d{1,12}\.\d{2}$/.test(valor)) throw new Error('Importe inválido: se requieren pesos y dos decimales.');
  return Math.round(Number(valor) * 100);
};
const fechaValida = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor;
export function validarEstadoBancario(paquete) {
  if (paquete?.version !== 1 || !Array.isArray(paquete.cuentas) || !paquete.cuentas.length || !Array.isArray(paquete.movimientos) || !paquete.movimientos.length || paquete.movimientos.length > 10000) throw new Error('El archivo no es un paquete bancario MONYS válido.');
  const ids = new Set(); const cuentas = new Set();
  for (const cuenta of paquete.cuentas) {
    if (!/^\d{4}$/.test(cuenta.terminacion) || cuentas.has(cuenta.terminacion) || !fechaValida(cuenta.desde) || !fechaValida(cuenta.hasta) || cuenta.desde > cuenta.hasta) throw new Error('Cuenta duplicada o periodo inválido.');
    cuentas.add(cuenta.terminacion);
  }
  for (const m of paquete.movimientos) {
    if (typeof m.id !== 'string' || !m.id || ids.has(m.id) || !cuentas.has(m.cuenta) || !fechaValida(m.fecha_operacion) || !fechaValida(m.fecha_liquidacion) || typeof m.descripcion !== 'string' || typeof m.referencia_visible !== 'string') throw new Error('Movimiento duplicado, fecha o cuenta inválida.');
    ids.add(m.id);
    const cargo = centavos(m.cargo); const abono = centavos(m.abono);
    if ((cargo > 0) === (abono > 0)) throw new Error('Cada movimiento debe tener un cargo o un abono.');
    const cuenta = paquete.cuentas.find(c => c.terminacion === m.cuenta);
    if (m.fecha_operacion < cuenta.desde || m.fecha_operacion > cuenta.hasta) throw new Error('Movimiento fuera del periodo del estado.');
    if (m.revision && (!['Por revisar', 'Confirmado'].includes(m.revision.estado) || typeof m.revision.clasificacion !== 'string' || typeof m.revision.nota !== 'string' || (m.revision.estado === 'Confirmado' && (!m.revision.clasificacion.trim() || !m.revision.nota.trim())))) throw new Error('La clasificación confirmada requiere nota y categoría.');
  }
  const resumen = paquete.cuentas.map(c => {
    const filas = paquete.movimientos.filter(m => m.cuenta === c.terminacion);
    const cargos = filas.reduce((s, m) => s + centavos(m.cargo), 0);
    const abonos = filas.reduce((s, m) => s + centavos(m.abono), 0);
    if (cargos !== centavos(c.cargos) || abonos !== centavos(c.abonos) || centavos(c.inicial) + abonos - cargos !== centavos(c.final) || filas.length !== c.movimientos) throw new Error(`La cuenta ·${c.terminacion} no cuadra con el resumen bancario.`);
    return { ...c, filas: filas.length, saldo: centavos(c.final) / 100 };
  });
  return { cuentas: resumen, saldo: resumen.reduce((s, c) => s + centavos(c.final), 0) / 100, movimientos: paquete.movimientos.length };
}
