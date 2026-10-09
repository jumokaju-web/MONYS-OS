import { validarEstadoBancario } from './validarEstadoBancario.js';
export function claveRevisionBancaria(usuario) {
  if (!usuario?.auth_user_id || !usuario?.organization_id || !usuario?.business_id || !usuario?.branch_id) return null;
  return JSON.stringify(['monys-banco-v1', usuario.auth_user_id, usuario.organization_id, usuario.business_id, usuario.branch_id]);
}
export function guardarRevisionBancaria(storage, clave, paquete) {
  if (!clave) throw new Error('Falta identificar usuario, negocio o sucursal: descarga la revisión para conservarla.');
  validarEstadoBancario(paquete);
  storage.setItem(clave, JSON.stringify({ version: 1, guardado: new Date().toISOString(), paquete }));
}
export function recuperarRevisionBancaria(storage, clave) {
  if (!clave) throw new Error('Falta identificar usuario, negocio o sucursal.');
  const raw = storage.getItem(clave);
  if (!raw) return null;
  const borrador = JSON.parse(raw);
  if (borrador.version !== 1 || typeof borrador.guardado !== 'string') throw new Error('El borrador no es válido. Conserva tu archivo descargado.');
  validarEstadoBancario(borrador.paquete);
  return borrador;
}
