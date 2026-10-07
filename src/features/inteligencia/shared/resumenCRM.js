export const ETAPAS_CRM = ["NUEVO", "CONTACTADO", "COTIZANDO", "GANADO", "PERDIDO"];

export function resumirCRM(oportunidades = [], hoy = new Date().toISOString().slice(0, 10)) {
  const filas = Array.isArray(oportunidades) ? oportunidades : [];
  const abiertas = filas.filter((item) => !["GANADO", "PERDIDO"].includes(item.etapa));
  const seguimientosPendientes = abiertas.filter(
    (item) => item.proximo_seguimiento && item.proximo_seguimiento <= hoy
  );
  const pipelineEstimado = abiertas.reduce((suma, item) => {
    const monto = item.monto_estimado == null ? 0 : Number(item.monto_estimado);
    return suma + (Number.isFinite(monto) && monto > 0 ? monto : 0);
  }, 0);
  return {
    total: filas.length,
    abiertas: abiertas.length,
    seguimientosPendientes: seguimientosPendientes.length,
    pipelineEstimado,
    montoConocido: abiertas.filter((item) => item.monto_estimado != null).length,
  };
}
