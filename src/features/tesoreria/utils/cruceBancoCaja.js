export function cruzarBancoCaja(banco = [], caja = []) {
 const validos = caja.filter(m => !/cancelado/i.test(m.estado ?? m.status ?? ''));
 return banco.flatMap(b => {
  const salida = Number(b.cargo) > 0;
  const centavos = Math.round(Number(salida ? b.cargo : b.abono) * 100);
  const candidatos = validos.filter(m => {
   const tipo = String(m.tipo ?? m.movement_type ?? '').toLowerCase();
   const mismaDireccion = salida ? ['salida','egreso'].includes(tipo) : ['entrada','ingreso'].includes(tipo);
   const fecha = String(m.fecha ?? m.occurred_at ?? '').slice(0,10);
   const monto = m.monto ?? m.amount;
   return mismaDireccion && monto !== null && monto !== undefined && monto !== '' && Number.isFinite(Number(monto)) && Math.round(Number(monto) * 100) === centavos && [b.fecha_operacion,b.fecha_liquidacion].includes(fecha);
  });
  return candidatos.length ? [{ banco:b, candidatos }] : [];
 });
}
