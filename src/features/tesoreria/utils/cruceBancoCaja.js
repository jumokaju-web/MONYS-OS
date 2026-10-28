import { fechaOperacionFinanciera } from "./fechaOperacionFinanciera.js";

export function cruzarBancoCaja(banco = [], caja = [], conciliaciones = []) {
 const validos = caja.filter(m => !/cancelado/i.test(m.estado ?? m.status ?? ''));
 const activas = conciliaciones.filter(item => item?.estado === 'ACTIVA');
 const porBanco = new Map(activas.map(item => [item.banco_movimiento_id, item]));
 const cajaUsada = new Map(activas.map(item => [item.cash_movement_id, item.banco_movimiento_id]));
 return banco.flatMap(b => {
  const salida = Number(b.cargo) > 0;
  const centavos = Math.round(Number(salida ? b.cargo : b.abono) * 100);
  const conciliacion = porBanco.get(b.id) || null;
  const candidatos = validos.filter(m => {
   const tipo = String(m.tipo ?? m.movement_type ?? '').toLowerCase();
   const mismaDireccion = salida ? ['salida','egreso'].includes(tipo) : ['entrada','ingreso'].includes(tipo);
   const fecha = fechaOperacionFinanciera(m.fecha ?? m.occurred_at);
   const monto = m.monto ?? m.amount;
   const vinculadaA = cajaUsada.get(m.id);
   return (!vinculadaA || vinculadaA === b.id) && mismaDireccion && monto !== null && monto !== undefined && monto !== '' && Number.isFinite(Number(monto)) && Math.round(Number(monto) * 100) === centavos && [b.fecha_operacion,b.fecha_liquidacion].includes(fecha);
  });
  return candidatos.length || conciliacion ? [{ banco:b, candidatos, conciliacion }] : [];
 });
}

export function resumirCruceBancoCaja(banco = [], caja = [], conciliaciones = []) {
 const cruces = cruzarBancoCaja(banco, caja, conciliaciones);
 const conciliados = cruces.filter(item => item.conciliacion).length;
 const candidatos = cruces.filter(item => !item.conciliacion && item.candidatos.length === 1).length;
 const ambiguos = cruces.filter(item => !item.conciliacion && item.candidatos.length > 1).length;
 return {
  totalBanco: banco.length,
  conciliados,
  candidatos,
  ambiguos,
  sinCoincidencia: Math.max(0, banco.length - conciliados - candidatos - ambiguos),
 };
}

export function listarBancoSinCoincidencia(banco = [], caja = [], conciliaciones = []) {
 const conCruce = new Set(cruzarBancoCaja(banco, caja, conciliaciones).map(item => item.banco.id));
 return banco.filter(movimiento => !conCruce.has(movimiento.id));
}
