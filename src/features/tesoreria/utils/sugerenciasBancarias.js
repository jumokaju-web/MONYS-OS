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
const beneficiariosConocidos = [
  { nombre: 'OSCAR', variantes: ['OSCAR'] },
  { nombre: 'PIÑA', variantes: ['PINA'] },
  { nombre: 'JOSHUA', variantes: ['JOSHUA', 'JOSH'] },
  { nombre: 'IVAN', variantes: ['IVAN'] },
  { nombre: 'EMANUEL', variantes: ['EMANUEL', 'EMMANUEL'] },
];
const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\d+/g, ' ').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
export function identificarBeneficiarioBancario(m) {
  const texto = [m?.descripcion, m?.referencia_visible].filter(Boolean).join(' ').toLocaleUpperCase('es-MX');
  const normalizado = normalizar(texto);
  const conocido = beneficiariosConocidos.find(persona => persona.variantes.some(variante => new RegExp(`\\b${variante}\\b`).test(normalizado)));
  if (conocido) return conocido.nombre;
  const exclusiones = new Set(['SPEI', 'STP', 'PAGO', 'PAGOS', 'TRANSFERENCIA', 'TRASPASO', 'DEPOSITO', 'DEPOSITO', 'BANCO', 'BBVA', 'SANTANDER', 'HSBC', 'BANORTE', 'SCOTIABANK', 'OXXO', 'CLABE', 'CUENTA', 'ENVIO', 'ENVIADO', 'OPERACION', 'REFERENCIA']);
  const candidatos = [...texto.matchAll(/(?:\b(?:A|AL|PARA|BENEFICIARIO|BENEFICIARIA|NOMBRE)\s+)([A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{3,}){0,2})/g)].map(x => x[1]);
  return candidatos.map(x => x.trim().split(/\s+/).filter(p => !exclusiones.has(normalizar(p))).join(' ')).find(Boolean) || '';
}
export function coincideBeneficiarioBancario(m, nombre) {
  return !nombre || identificarBeneficiarioBancario(m) === nombre;
}
export function claveReglaBancaria(m) {
  const beneficiario = identificarBeneficiarioBancario(m);
  const concepto = normalizar(m?.descripcion);
  const direccion = Number(m?.cargo) > 0 ? 'SALIDA' : Number(m?.abono) > 0 ? 'ENTRADA' : '';
  if (!beneficiario || !concepto || !direccion || !m?.cuenta) return '';
  return [m.cuenta, direccion, concepto, normalizar(beneficiario)].join('|');
}
export function actualizarReglasBancarias(paquete) {
  const reglas = new Map((paquete?.reglas_bancarias || []).filter(r => r?.clave && (r?.categoria || r.conflicto)).map(r => [r.clave, r]));
  const actuales = new Map();
  for (const m of paquete?.movimientos || []) {
    if (m.revision?.estado !== 'Confirmado') continue;
    const clave = claveReglaBancaria(m);
    if (!clave) continue;
    const categorias = actuales.get(clave) || new Set();
    categorias.add(m.revision.clasificacion);
    actuales.set(clave, categorias);
  }
  for (const [clave, categorias] of actuales) {
    const anterior = reglas.get(clave);
    if (categorias.size > 1 || (anterior && !anterior.conflicto && !categorias.has(anterior.categoria))) {
      reglas.set(clave, { clave, conflicto: true });
    } else if (categorias.size === 1 && !anterior?.conflicto) {
      reglas.set(clave, { clave, categoria: [...categorias][0], conflicto: false });
    }
  }
  return { ...paquete, reglas_bancarias: [...reglas.values()].slice(-500) };
}
export function aplicarReglasBancarias(paquete, reglas = paquete?.reglas_bancarias || []) {
  const reglasPorClave = new Map((reglas || []).filter(r => r?.clave && r?.categoria && !r.conflicto).map(r => [r.clave, r]));
  let sugeridas = 0;
  const movimientos = (paquete?.movimientos || []).map(m => {
    if (m.revision?.estado === 'Confirmado' || m.revision?.clasificacion || sugerirMovimientoBancario(m).categoria) return m;
    const regla = reglasPorClave.get(claveReglaBancaria(m));
    if (!regla) return m;
    sugeridas++;
    return { ...m, revision: { estado: 'Por revisar', clasificacion: regla.categoria, nota: 'Sugerencia basada en una clasificación confirmada anteriormente para el mismo beneficiario, concepto, cuenta y tipo de movimiento. Confirma antes de guardar.', origen: 'regla_historica_monys' } };
  });
  return { paquete: { ...paquete, reglas_bancarias: reglas || [], movimientos }, sugeridas };
}
export function sugerirMovimientoBancario(m) {
  const coincidencias = (Array.isArray(m.evidencia_whatsapp) ? m.evidencia_whatsapp : []).filter(e =>
    typeof e.texto === 'string' && Number.isInteger(e.importe) && e.importe === Math.round((Number(m.cargo) + Number(m.abono)) * 100) && [m.fecha_operacion, m.fecha_liquidacion].includes(e.fecha));
  const pista = pistas[m.categoria];
  const textoMovimiento = [m.descripcion, m.referencia_visible, ...coincidencias.map(e => e.texto)].filter(Boolean).join(' ');
  const sueldoExplicito = Number(m.cargo) > 0 && /\b(sueldo|n[oó]mina)\b/i.test([m.descripcion, m.referencia_visible].filter(Boolean).join(' '));
  const mencionaAdelantoChofer = Number(m.cargo) > 0
    && /\b(adelanto|anticipo|pr[eé]stamo)\b/i.test(textoMovimiento)
    && /\b(chofer(?:es)?|driver|descontar|descuento|recuperable)\b/i.test(textoMovimiento);
  // Los mensajes son candidatos; nunca cambian la clasificación aprobada.
  let categoria = pista?.[0] || (mencionaAdelantoChofer ? 'Préstamo por recuperar' : '');
  let motivo = pista?.[1] || (mencionaAdelantoChofer ? 'La referencia menciona un adelanto recuperable a un chofer; confirma el beneficiario antes de guardar el bloque.' : 'Falta explicar el destino con un comprobante o mensaje.');
  if (!categoria && sueldoExplicito) {
    categoria = 'Nómina';
    motivo = 'La descripción o referencia bancaria indica sueldo o nómina. Revisa el nombre del empleado y confirma antes de guardar.';
  }
  const posibleNomina = !categoria && Number(m.cargo) > 0 && coincidencias.length > 1 && coincidencias.every(e => /\b(sueldo|n[oó]mina)\b/i.test(e.texto));
  if (!categoria && coincidencias.length === 1 && Number(m.cargo) > 0 && /\b(sueldo|n[oó]mina)\b/i.test(coincidencias[0].texto)) {
    categoria = 'Nómina'; motivo = 'Hay un mensaje del mismo importe y fecha que menciona sueldo. Comprueba que corresponde a este pago.';
  }
  if (!categoria && m.revision?.origen === 'regla_historica_monys' && m.revision?.clasificacion) {
    categoria = m.revision.clasificacion;
    motivo = m.revision.nota;
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

// Agrupa los movimientos sin destino por el nombre escrito en el concepto o
// referencia. Es una pista de revisión, no una asignación contable.
export function agruparPendientesPorNombre(movimientos = []) {
  const grupos = new Map();
  for (const m of movimientos) {
    if (m.revision?.estado === 'Confirmado' || sugerirMovimientoBancario(m).categoria) continue;
    const nombre = identificarBeneficiarioBancario(m);
    if (!nombre) continue;
    const key = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const g = grupos.get(key) || { nombre, cantidad: 0, cargos: 0, abonos: 0, movimientos: [] };
    g.cantidad++;
    g.cargos += Math.round((Number(m.cargo) || 0) * 100);
    g.abonos += Math.round((Number(m.abono) || 0) * 100);
    g.movimientos.push(m);
    grupos.set(key, g);
  }
  return [...grupos.values()].map(g => ({ ...g, cargos: g.cargos / 100, abonos: g.abonos / 100 })).filter(g => g.cantidad > 1).sort((a, b) => b.cantidad - a.cantidad);
}

export function clasificarGrupoBeneficiario(paquete, nombre, categoria, nota, fecha = new Date().toISOString()) {
  if (!nombre || !categoria || !nota?.trim()) throw new Error('Elige una categoría y escribe la nota común del grupo.');
  const grupo = agruparPendientesPorNombre(paquete?.movimientos || []).find(g => g.nombre === nombre);
  if (!grupo?.movimientos.length) throw new Error('Este grupo ya no tiene movimientos pendientes para clasificar.');
  if (grupo.cargos > 0 && grupo.abonos > 0) throw new Error('El grupo mezcla salidas y entradas; sepáralas antes de clasificar en bloque.');
  const ids = new Set(grupo.movimientos.map(m => m.id));
  return {
    ...paquete,
    movimientos: paquete.movimientos.map(m => ids.has(m.id) ? {
      ...m,
      revision: {
        estado: 'Confirmado',
        clasificacion: categoria,
        nota: `Beneficiario identificado por referencia: ${nombre}. ${nota.trim()}`,
        fecha,
        origen: 'confirmacion_lote_beneficiario',
      },
    } : m),
  };
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
