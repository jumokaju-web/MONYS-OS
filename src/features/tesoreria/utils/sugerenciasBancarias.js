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
  const textoMovimiento = [m.descripcion, m.referencia_visible, ...coincidencias.map(e => e.texto)].filter(Boolean).join(' ');
  const mencionaAdelantoChofer = Number(m.cargo) > 0
    && /\b(adelanto|anticipo|pr[eé]stamo)\b/i.test(textoMovimiento)
    && /\b(chofer(?:es)?|driver|descontar|descuento|recuperable)\b/i.test(textoMovimiento);
  // Los mensajes son candidatos; nunca cambian la clasificación aprobada.
  let categoria = pista?.[0] || (mencionaAdelantoChofer ? 'Préstamo por recuperar' : '');
  let motivo = pista?.[1] || (mencionaAdelantoChofer ? 'La referencia menciona un adelanto recuperable a un chofer; confirma el beneficiario antes de guardar el bloque.' : 'Falta explicar el destino con un comprobante o mensaje.');
  const posibleNomina = !categoria && Number(m.cargo) > 0 && coincidencias.length > 1 && coincidencias.every(e => /\b(sueldo|n[oó]mina)\b/i.test(e.texto));
  if (!categoria && coincidencias.length === 1 && Number(m.cargo) > 0 && /\b(sueldo|n[oó]mina)\b/i.test(coincidencias[0].texto)) {
    categoria = 'Nómina'; motivo = 'Hay un mensaje del mismo importe y fecha que menciona sueldo. Comprueba que corresponde a este pago.';
  }
  return { categoria, motivo, coincidencias, ambigua: coincidencias.length > 1, categoriaCandidata: posibleNomina ? 'Nómina' : '' };
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

export function prepararLoteSugerido(movimientos, nombre) {
  if (!nombre || nombre === 'Sin destino identificado') return { movimientos: [], ambiguos: 0, importe: 0 };
  const elegibles = [];
  let ambiguos = 0;
  for (const movimiento of movimientos || []) {
    if (movimiento.revision?.estado === 'Confirmado') continue;
    const sugerencia = sugerirMovimientoBancario(movimiento);
    if (sugerencia.ambigua && sugerencia.categoriaCandidata === nombre) { ambiguos++; continue; }
    if (sugerencia.categoria !== nombre) continue;
    if (sugerencia.ambigua) { ambiguos++; continue; }
    elegibles.push(movimiento);
  }
  const centavos = elegibles.reduce((total, m) => total + Math.round((Number(m.cargo) || Number(m.abono) || 0) * 100), 0);
  return { movimientos: elegibles, ambiguos, importe: centavos / 100 };
}

export function clasificarLoteSugerido(paquete, nombre, nota, fecha = new Date().toISOString()) {
  if (!nota?.trim()) throw new Error('Escribe el criterio contable que aplica a todo el bloque.');
  const lote = prepararLoteSugerido(paquete?.movimientos, nombre);
  if (!lote.movimientos.length) throw new Error('No hay movimientos claros pendientes para este bloque.');
  const ids = new Set(lote.movimientos.map(m => m.id));
  return {
    ...paquete,
    movimientos: paquete.movimientos.map(m => ids.has(m.id) ? {
      ...m,
      revision: { estado: 'Confirmado', clasificacion: nombre, nota: nota.trim(), fecha, origen: 'confirmacion_lote_sugerido' },
    } : m),
  };
}

export function prepararClasificacionSegura(movimientos = []) {
  const grupos = agruparSugerenciasBancarias(movimientos)
    .filter(grupo => grupo.nombre !== 'Sin destino identificado')
    .map(grupo => ({ categoria: grupo.nombre, ...prepararLoteSugerido(movimientos, grupo.nombre) }))
    .filter(grupo => grupo.movimientos.length > 0);
  const ids = new Set(grupos.flatMap(grupo => grupo.movimientos.map(movimiento => movimiento.id)));
  const importe = grupos.reduce((total, grupo) => total + Math.round(grupo.importe * 100), 0) / 100;
  const ambiguos = grupos.reduce((total, grupo) => total + grupo.ambiguos, 0);
  const excepciones = movimientos.filter(movimiento => movimiento.revision?.estado !== 'Confirmado' && !ids.has(movimiento.id)).length;
  return { grupos, movimientos: ids.size, importe, ambiguos, excepciones };
}

export function clasificarSugerenciasSeguras(paquete, fecha = new Date().toISOString()) {
  const plan = prepararClasificacionSegura(paquete?.movimientos || []);
  if (!plan.movimientos) throw new Error('No hay movimientos seguros pendientes para clasificar.');
  const categoriasPorId = new Map(plan.grupos.flatMap(grupo => grupo.movimientos.map(movimiento => [movimiento.id, grupo.categoria])));
  return {
    ...paquete,
    movimientos: paquete.movimientos.map(movimiento => {
      const clasificacion = categoriasPorId.get(movimiento.id);
      if (!clasificacion) return movimiento;
      return {
        ...movimiento,
        revision: {
          estado: 'Confirmado',
          clasificacion,
          nota: `Clasificación contable por regla segura de MONYS: ${clasificacion}. El concepto fue identificado sin evidencia contradictoria; las excepciones permanecen pendientes.`,
          fecha,
          origen: 'clasificacion_segura_monys',
        },
      };
    }),
  };
}
