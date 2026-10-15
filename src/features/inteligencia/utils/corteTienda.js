export function fechaOperativaMexico(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
export const CAMPOS_CORTE = ['ventaSicar', 'efectivoVentas', 'tarjeta', 'transferencias', 'otrosCobros', 'fondoInicial', 'efectivoEntregado', 'efectivoFinal'];
export function validarImportesCorte(datos) {
  for (const campo of CAMPOS_CORTE) {
    const valor = datos[campo];
    if (!['string','number'].includes(typeof valor) || String(valor).trim()==='' || !Number.isFinite(Number(valor)) || Number(valor)<0) return 'Completa los importes reales de venta, cobros y efectivo. Escribe 0 únicamente cuando confirmes que no hubo importe.';
  }
  return '';
}
