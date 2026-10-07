export const ETAPAS_CRM = ["NUEVO", "CONTACTADO", "COTIZANDO", "GANADO", "PERDIDO"];

export function resumirCRM(oportunidades = [], hoy = new Date().toISOString().slice(0, 10)) {
  const filas = Array.isArray(oportunidades) ? oportunidades : [];
  const abiertas = filas.filter((item) => !["GANADO", "PERDIDO"].includes(item.etapa));
  const seguimientosPendientes = abiertas.filter(
    (item) => item.proximo_seguimiento && item.proximo_seguimiento <= hoy
  );
  const porEtapa = Object.fromEntries(
    ETAPAS_CRM.map((etapa) => [etapa, filas.filter((item) => item.etapa === etapa).length])
  );
  const ganadas = porEtapa.GANADO;
  const perdidas = porEtapa.PERDIDO;
  const cerradas = ganadas + perdidas;
  const pipelineEstimado = abiertas.reduce((suma, item) => {
    const monto = item.monto_estimado == null ? 0 : Number(item.monto_estimado);
    return suma + (Number.isFinite(monto) && monto > 0 ? monto : 0);
  }, 0);
  return {
    total: filas.length,
    abiertas: abiertas.length,
    porEtapa,
    ganadas,
    perdidas,
    tasaCierre: cerradas ? Math.round((ganadas / cerradas) * 100) : null,
    seguimientosPendientes: seguimientosPendientes.length,
    pipelineEstimado,
    montoConocido: abiertas.filter((item) => item.monto_estimado != null).length,
  };
}
