export const CONTROLES_CIERRE = ['ventas', 'caja', 'banco', 'gastos', 'prestamos'];
export function claveBorradorCierre(usuario, inicio, fin) {
  if (!usuario?.auth_user_id || !usuario?.organization_id || !usuario?.business_id || !inicio || !fin) return null;
  return `monys:cierre:v1:${usuario.organization_id}:${usuario.business_id}:${usuario.auth_user_id}:${inicio}:${fin}`;
}
export function leerBorradorCierre(storage, clave, revision) {
  if (!clave) return { confirmaciones: {}, estado: 'sin_identidad' };
  try {
    const texto = storage.getItem(clave);
    if (!texto) return { confirmaciones: {}, estado: 'nuevo' };
    const borrador = JSON.parse(texto);
    if (borrador.revision !== revision) return { confirmaciones: {}, estado: 'datos_cambiaron' };
    return { confirmaciones: Object.fromEntries(CONTROLES_CIERRE.map((campo) => [campo, borrador.confirmaciones?.[campo] === true])), estado: 'recuperado', actualizado: borrador.actualizado };
  } catch {
    return { confirmaciones: {}, estado: 'error' };
  }
}
export function guardarBorradorCierre(storage, clave, revision, confirmaciones) {
  if (!clave) return false;
  try {
    storage.setItem(clave, JSON.stringify({ revision, confirmaciones: Object.fromEntries(CONTROLES_CIERRE.map((campo) => [campo, confirmaciones[campo] === true])), actualizado: new Date().toISOString() }));
    return true;
  } catch { return false; }
}
