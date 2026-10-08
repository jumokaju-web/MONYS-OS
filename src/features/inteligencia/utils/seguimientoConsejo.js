export function fechaConsejoHoy(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
export function fechaConsejoValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return false;
  const d = new Date(`${fecha}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}
export function resumirSeguimientoConsejo(tareas = [], hoy = fechaConsejoHoy()) {
  const vistos = new Set();
  const filas = tareas.filter(t => t.id && !vistos.has(t.id) && vistos.add(t.id)).map(t => {
    const terminada = t.estado === 'terminada';
    const cancelada = t.estado === 'cancelada';
    const resultado = typeof t.resultado === 'string' ? Boolean(t.resultado.trim()) : Boolean(t.resultado && Object.keys(t.resultado).length);
    const revisada = terminada && resultado && t.evaluacion_estado === 'aprobada' && t.requiere_revision === false;
    const vencida = !terminada && !cancelada && fechaConsejoValida(t.fecha) && t.fecha < hoy;
    const etiqueta = cancelada ? 'Cancelada' : revisada ? 'Resultado revisado' : terminada ? 'Cierre por verificar' : vencida ? 'Revisión vencida' : 'En seguimiento';
    return { ...t, resultadoDisponible: resultado, revisada, vencida, cancelada, etiqueta, sinResponsable: !t.responsable?.trim(), sinFecha: !fechaConsejoValida(t.fecha) };
  }).sort((a,b) => Number(b.vencida)-Number(a.vencida) || Number(a.revisada)-Number(b.revisada) || String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')));
  return { filas, total: filas.length, vencidas: filas.filter(t=>t.vencida).length, porVerificar: filas.filter(t=>t.etiqueta === 'Cierre por verificar').length, revisadas: filas.filter(t=>t.revisada).length, incompletas: filas.filter(t=>!t.cancelada && (t.sinFecha || t.sinResponsable)).length };
}
export function tituloPropuestaConsejo(propuesta, periodo) {
  return `[Consejo] ${propuesta.titulo.trim()} · ${periodo || 'Sin corte'}`;
}
