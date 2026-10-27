export function fechaOperativaMexico(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
export const CAMPOS_CORTE = ['ventaSicar', 'efectivoVentas', 'tarjeta', 'transferencias', 'otrosCobros', 'fondoInicial', 'efectivoEntregado', 'efectivoFinal'];
export const TURNOS_CORTE = [
  ['MATUTINO', 'Mañana'],
  ['VESPERTINO', 'Tarde / noche'],
  ['COMPLETO', 'Día completo'],
];
export const DESTINOS_EFECTIVO_RETIRADO = [
  ['RESGUARDO', 'Quedó bajo resguardo'],
  ['DEPOSITO_BANCARIO', 'Se llevará o llevó al banco'],
  ['PAGO_DIRECTO', 'Se entregó para un pago'],
  ['OTRO', 'Otro destino'],
];
export function validarImportesCorte(datos) {
  for (const campo of CAMPOS_CORTE) {
    const valor = datos?.[campo];
    if (!['string','number'].includes(typeof valor) || String(valor).trim()==='' || !Number.isFinite(Number(valor)) || Number(valor)<0) return 'Completa los importes reales de venta, cobros y efectivo. Escribe 0 únicamente cuando confirmes que no hubo importe.';
  }
  return '';
}

export function validarDestinoEfectivoRetirado(datos = {}) {
  const retirado = Number(datos.efectivoEntregado);
  if (!Number.isFinite(retirado) || retirado <= 0) return '';
  const destinos = new Set(DESTINOS_EFECTIVO_RETIRADO.map(([valor]) => valor));
  if (!destinos.has(String(datos.destinoEfectivoRetirado || '').trim())) {
    return 'Indica qué pasó con el efectivo retirado.';
  }
  if (!String(datos.responsableEfectivoRetirado || '').trim()) {
    return 'Indica quién recibió o resguarda el efectivo retirado.';
  }
  if (!String(datos.detalleEfectivoRetirado || '').trim()) {
    return 'Escribe la cuenta, pago, lugar de resguardo o referencia del efectivo retirado.';
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
  if (!TURNOS_CORTE.some(([valor]) => valor === String(formulario?.turnoCaja || '').trim())) {
    return 'Selecciona si este corte corresponde a la mañana, tarde / noche o día completo.';
  }
  if (!tieneSesionCaja && !corteSinApertura) {
    return 'Abre la caja o selecciona registrar cierre sin apertura previa.';
  }
  if (!fotoCorte) {
    return 'Toma o selecciona la foto del corte de SICAR antes de cerrar la caja.';
  }
  return validarImportesCorte(formulario) || validarDestinoEfectivoRetirado(formulario);
}
