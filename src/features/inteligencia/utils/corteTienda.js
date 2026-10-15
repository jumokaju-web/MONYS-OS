export function fechaOperativaMexico(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
export const CAMPOS_CORTE = ['ventaSicar', 'efectivoVentas', 'tarjeta', 'transferencias', 'otrosCobros', 'fondoInicial', 'efectivoEntregado', 'efectivoFinal'];
export function validarImportesCorte(datos) {
  for (const campo of CAMPOS_CORTE) {
    const valor = datos?.[campo];
    if (!['string','number'].includes(typeof valor) || String(valor).trim()==='' || !Number.isFinite(Number(valor)) || Number(valor)<0) return 'Completa los importes reales de venta, cobros y efectivo. Escribe 0 únicamente cuando confirmes que no hubo importe.';
  }
  return '';
}

export function validarCierreCajaParaEnvio({
  responsable,
  branchId,
  cajaId,
  tieneSesionCaja = false,
  corteSinApertura = false,
  fotoCorte,
  formulario,
} = {}) {
  if (!String(responsable || '').trim()) {
    return 'No fue posible confirmar quién realiza el cierre. Vuelve a iniciar sesión.';
  }
  if (!branchId) return 'No se pudo identificar la sucursal. Avisa a Dirección.';
  if (!cajaId) return 'Selecciona Caja 1 o Caja 2 antes de registrar el cierre.';
  if (!tieneSesionCaja && !corteSinApertura) {
    return 'Abre la caja o selecciona registrar cierre sin apertura previa.';
  }
  if (!fotoCorte) {
    return 'Toma o selecciona la foto del corte de SICAR antes de cerrar la caja.';
  }
  return validarImportesCorte(formulario);
}
