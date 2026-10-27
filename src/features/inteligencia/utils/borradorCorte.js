import { CAMPOS_CORTE, fechaOperativaMexico } from './corteTienda.js';

const PREFIJO = 'monys:borrador-corte:v1:';
const DURACION = 12 * 60 * 60 * 1000;
const camposTexto = [...CAMPOS_CORTE, 'turnoCaja', 'destinoEfectivoRetirado', 'responsableEfectivoRetirado', 'detalleEfectivoRetirado', 'pendientes', 'incidencias', 'productosSolicitados', 'objecionesClientes', 'aprendizajes', 'observaciones'];

export function prefijoBorradorUsuario(usuario) {
  const id = usuario?.auth_user_id || usuario?.id;
  return id ? `${PREFIJO}${encodeURIComponent(id)}:` : null;
}
export function claveBorradorCorte(usuario, branchId, ahoraOCaja = new Date()) {
  const prefijo = prefijoBorradorUsuario(usuario);
  const ahora = ahoraOCaja instanceof Date ? ahoraOCaja : new Date();
  const caja = ahoraOCaja instanceof Date ? '' : `:${encodeURIComponent(String(ahoraOCaja || ''))}`;
  return prefijo && branchId && (!caja || ahoraOCaja) ? `${prefijo}${encodeURIComponent(branchId)}${caja}:${fechaOperativaMexico(ahora)}` : null;
}
export function limpiarFormularioBorrador(formulario) {
  const limpio = Object.fromEntries(camposTexto.map(c => [c, String(formulario[c] ?? '')]));
  limpio.movimientosCaja = (Array.isArray(formulario.movimientosCaja) ? formulario.movimientosCaja : []).map(m => ({
    id: String(m.id || ''), tipo: m.tipo === 'entrada' ? 'entrada' : 'salida',
    categoria: String(m.categoria || 'otro'), concepto: String(m.concepto || ''),
    recibidoPor: String(m.recibidoPor || ''), monto: String(m.monto ?? ''),
  }));
  return limpio;
}
export function tieneCapturaBorrador(formulario) {
  return camposTexto.filter(c => c !== 'fondoInicial').some(c => String(formulario[c] ?? '').trim()) ||
    formulario.movimientosCaja?.some(m => [m.monto, m.concepto, m.recibidoPor].some(v => String(v ?? '').trim()));
}
export function guardarBorradorCorte(storage, clave, formulario, sesionCajaId, sinApertura, ahora = new Date()) {
  if (!clave) return;
  if (!tieneCapturaBorrador(formulario)) { storage.removeItem(clave); return; }
  storage.setItem(clave, JSON.stringify({ version: 1, guardadoEn: ahora.toISOString(), sesionCajaId: sesionCajaId || null, sinApertura: Boolean(sinApertura), formulario: limpiarFormularioBorrador(formulario) }));
}
export function leerBorradorCorte(storage, clave, ahora = new Date()) {
  if (!clave) return null;
  const texto = storage.getItem(clave);
  if (!texto) return null;
  try {
    const dato = JSON.parse(texto);
    const edad = ahora.getTime() - Date.parse(dato.guardadoEn);
    if (dato.version !== 1 || !Number.isFinite(edad) || edad < 0 || edad > DURACION || !dato.formulario || typeof dato.formulario !== 'object') throw new Error('Borrador vencido');
    return { ...dato, formulario: limpiarFormularioBorrador(dato.formulario) };
  } catch { storage.removeItem(clave); return null; }
}
export function borrarBorradoresUsuario(storage, usuario) {
  const prefijo = prefijoBorradorUsuario(usuario);
  if (!prefijo) return;
  for (let i = storage.length - 1; i >= 0; i--) {
    const clave = storage.key(i);
    if (clave?.startsWith(prefijo)) storage.removeItem(clave);
  }
}
