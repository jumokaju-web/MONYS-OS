const pistas = {
  'Comisión bancaria / IVA': ['Comisión bancaria / IVA', 'El banco identifica una comisión o IVA. Comprueba su relación con la terminal y la cuenta.'],
  'Abono de terminal: conciliar SICAR': ['Cobro de tienda: conciliar SICAR', 'Compara el cobro con SICAR antes de contar otra venta.'],
  'Posible combustible': ['Combustible', 'Falta confirmar vehículo, uso y comprobante.'],
  'Cobro de paquetería': ['Cobro de flotilla', 'Comprueba socio, rutas y periodo pagado.'],
  'Pago de tarjeta: falta desglose': ['Pago de tarjeta', 'Falta separar compras, intereses y capital.'],
  'Pago de crédito: falta desglose': ['Pago de crédito', 'Falta separar capital e intereses.'],
  'Préstamo: confirmar destino': ['Préstamo por recuperar', 'Confirma beneficiario y si el dinero debe devolverse.'],
  'Transferencia interna pareada': ['Transferencia interna', 'Comprueba ambos movimientos y la propiedad de las cuentas.'],
};
export function sugerirMovimientoBancario(m) {
  const coincidencias = (Array.isArray(m.evidencia_whatsapp) ? m.evidencia_whatsapp : []).filter(e =>
    typeof e.texto === 'string' && Number.isInteger(e.importe) && e.importe === Math.round((Number(m.cargo) + Number(m.abono)) * 100) && [m.fecha_operacion, m.fecha_liquidacion].includes(e.fecha));
  const pista = pistas[m.categoria];
  // Los mensajes son candidatos; nunca cambian la clasificación aprobada.
  let categoria = pista?.[0] || '';
  let motivo = pista?.[1] || 'Falta explicar el destino con un comprobante o mensaje.';
  if (!categoria && coincidencias.length === 1 && Number(m.cargo) > 0 && /\b(sueldo|n[oó]mina)\b/i.test(coincidencias[0].texto)) {
    categoria = 'Nómina'; motivo = 'Hay un mensaje del mismo importe y fecha que menciona sueldo. Comprueba que corresponde a este pago.';
  }
  return { categoria, motivo, coincidencias, ambigua: coincidencias.length > 1 };
}
export function agruparSugerenciasBancarias(movimientos) {
  const grupos = new Map();
  for (const m of movimientos) {
    if (m.revision?.estado === 'Confirmado') continue;
    const sugerencia = sugerirMovimientoBancario(m);
    const nombre = sugerencia.categoria || 'Sin destino identificado';
    const g = grupos.get(nombre) || { nombre, cantidad: 0, cargos: 0, abonos: 0 };
    g.cantidad++; g.cargos += Math.round(Number(m.cargo) * 100); g.abonos += Math.round(Number(m.abono) * 100); grupos.set(nombre, g);
  }
  return [...grupos.values()].map(g => ({ ...g, cargos: g.cargos / 100, abonos: g.abonos / 100 })).sort((a, b) => b.cantidad - a.cantidad);
}
