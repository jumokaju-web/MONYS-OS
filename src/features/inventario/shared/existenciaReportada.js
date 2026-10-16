export function leerExistenciaReportada(detalle) {
  const datosOriginales = detalle?.datos_originales || {};
  const candidatos = [
    detalle?.existencia,
    datosOriginales.existencia,
    datosOriginales.exis,
    datosOriginales.stock,
    detalle?.cantidad,
    datosOriginales.cantidad,
  ];
  for (const valor of candidatos) {
    if (valor === null || valor === undefined || String(valor).trim() === "") continue;
    const numero = Number(valor);
    if (Number.isFinite(numero)) return numero;
  }
  return null;
}
