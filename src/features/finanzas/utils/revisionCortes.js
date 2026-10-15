export function estadoRevisionCorte(captura, revision) {
  if (!revision) return 'PENDIENTE';
  return revision.snapshot_observaciones === captura.cierre.observaciones ? revision.estado : 'DESACTUALIZADO';
}
export function validarRevisionCorte({ estado, nota, evidencia, comprobaciones }) {
  if (!['ACLARAR', 'REVISADO'].includes(estado)) return 'Selecciona el resultado de la revisión.';
  if (String(nota || '').trim().length < 10 || String(nota || '').trim().length > 2000) return 'Explica lo que revisaste o falta aclarar (10 a 2000 caracteres).';
  if (String(evidencia || '').trim().length < 3 || String(evidencia || '').trim().length > 500) return 'Indica el comprobante o referencia de evidencia (3 a 500 caracteres).';
  if (estado === 'REVISADO' && !['sicar', 'cobros', 'movimientos'].every(c => comprobaciones?.[c] === true)) return 'Comprueba SICAR, cobros y movimientos antes de marcar revisado.';
  return '';
}
export const etiquetasRevision = { PENDIENTE: 'Pendiente de revisión', ACLARAR: 'En aclaración', REVISADO: 'Revisado por propietaria', DESACTUALIZADO: 'El corte cambió · revisar de nuevo' };

export function resumirEstadosRevision(capturas, revisiones = {}) {
  const resumen = { PENDIENTE: 0, ACLARAR: 0, DESACTUALIZADO: 0, REVISADO: 0 };
  for (const captura of capturas) {
    if (captura.tipo !== 'caja') continue;
    const estado = estadoRevisionCorte(captura, revisiones[captura.cierre.id]);
    if (Object.hasOwn(resumen, estado)) resumen[estado]++;
  }
  return resumen;
}
