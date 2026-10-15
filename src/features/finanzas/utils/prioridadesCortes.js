import { estadoRevisionCorte } from './revisionCortes.js';
function importe(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function diagnosticarCorte(captura) {
  if (captura.tipo !== 'caja') return { nivel: 'revision', peso: 1, titulo: 'Revisar liquidación', accion: 'Compara ingresos y gastos con los comprobantes de la ruta.' };
  const { datos } = captura;
  const caja = importe(datos.diferenciaCaja);
  const venta = importe(datos.diferenciaVenta);
  if (caja === null || venta === null) return { nivel: 'incompleto', peso: 4, titulo: 'Datos incompletos', accion: 'Completa las diferencias de caja y venta antes de evaluar este corte.' };
  if (Math.abs(caja) >= 0.01 || Math.abs(venta) >= 0.01) return { nivel: 'diferencia', peso: 3, titulo: 'Diferencia por aclarar', accion: 'Revisa el efectivo contado, los cobros y las salidas con la responsable. Una diferencia no demuestra una pérdida.' };
  if (!datos.fotoCorteUrl) return { nivel: 'evidencia', peso: 2, titulo: 'Falta foto del corte', accion: 'Solicita el comprobante de SICAR antes de dar por comprobados los importes.' };
  return { nivel: 'revision', peso: 1, titulo: 'Sin diferencia detectada', accion: 'Compara la foto de SICAR con cobros y movimientos. Este diagnóstico no aprueba ni concilia el corte.' };
}

export function seleccionarCortes(capturas, filtros = {}, revisiones = {}) {
  const peso = c => estadoRevisionCorte(c, revisiones[c.cierre.id]) === 'REVISADO' ? 0 : diagnosticarCorte(c).peso;
  const buscar = String(filtros.buscar || '').trim().toLocaleLowerCase('es-MX');
  return capturas.filter(c => {
    const fecha = String(c.cierre.fecha || '').slice(0, 10);
    return (!filtros.desde || fecha >= filtros.desde) &&
      (!filtros.hasta || fecha <= filtros.hasta) &&
      (!filtros.tipo || c.tipo === filtros.tipo) &&
      (!filtros.nivel || diagnosticarCorte(c).nivel === filtros.nivel) &&
      (!buscar || [c.cierre.responsable, c.datos.chofer, c.datos.placas, c.datos.codigoRuta].some(v => String(v || '').toLocaleLowerCase('es-MX').includes(buscar)));
  }).sort((a, b) => peso(b) - peso(a) || String(b.cierre.fecha || '').localeCompare(String(a.cierre.fecha || '')) || String(a.cierre.id).localeCompare(String(b.cierre.id)));
}

export function resumirAlertasCortes(capturas, revisiones = {}) {
  const resumen = { faltantes: 0, sobrantes: 0, conDiferencia: 0, sinEvidencia: 0, incompletos: 0 };
  for (const c of capturas.filter(c => c.tipo === 'caja')) {
    const caja = importe(c.datos.diferenciaCaja);
    if (caja !== null) {
      if (caja <= -0.01) resumen.faltantes += -caja;
      if (caja >= 0.01) resumen.sobrantes += caja;
    }
    const diagnostico = diagnosticarCorte(c);
    if (diagnostico.nivel === 'diferencia' && estadoRevisionCorte(c, revisiones[c.cierre.id]) !== 'REVISADO') resumen.conDiferencia++;
    if (diagnostico.nivel === 'incompleto') resumen.incompletos++;
    if (!c.datos.fotoCorteUrl) resumen.sinEvidencia++;
  }
  resumen.faltantes = Math.round(resumen.faltantes * 100) / 100;
  resumen.sobrantes = Math.round(resumen.sobrantes * 100) / 100;
  return resumen;
}
