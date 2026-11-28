/*
 * DIAGNÓSTICO DE CANCELACIONES · MONYS OS
 *
 * Explica por qué se cancelan las ventas de un marketplace y cuáles dañan
 * la reputación. Entrada: órdenes con la forma de la conexión de Mercado
 * Libre (status, cancel_group, tags, items, fecha) y, opcionalmente,
 * reclamos ({ order_id, afecta_reputacion, reason_familia }).
 *
 * Patrones que se señalan (sugerencias para revisar, no cambios):
 * - "vendedor": el vendedor canceló (sin stock, precio o publicación
 *   equivocada). Es lo que más daña la reputación.
 * - "pago_no_concretado": orden no pagada; no suele afectar reputación.
 * - "fraude": la plataforma la detuvo por riesgo.
 * - Publicación cancelada 2+ veces: revisar existencia, precio y título.
 * Módulo puro.
 */

const GRUPOS = {
  seller: "vendedor",
  fraud: "fraude",
  internal: "plataforma",
  buyer: "comprador",
};

function clasificar(orden) {
  const grupo = GRUPOS[orden?.cancel_group];
  if (grupo) return grupo;
  const tags = new Set(orden?.tags || []);
  if (tags.has("fraud_risk_detected")) return "fraude";
  if (tags.has("not_paid")) return "pago_no_concretado";
  return "sin_motivo";
}

export function diagnosticarCancelaciones(ordenes = [], { reclamos = [] } = {}) {
  const lista = ordenes || [];
  const canceladas = lista.filter((orden) => String(orden?.status).toLowerCase() === "cancelled");
  const reputacionPorOrden = new Map(
    (reclamos || []).map((reclamo) => [String(reclamo.order_id), reclamo.afecta_reputacion])
  );

  const porMotivo = {};
  const porPublicacion = new Map();
  let afectanReputacion = 0;
  let reputacionDesconocida = 0;

  for (const orden of canceladas) {
    const motivo = clasificar(orden);
    porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;

    const afecta = reputacionPorOrden.get(String(orden.id));
    if (afecta === "affected") afectanReputacion += 1;
    else if (afecta === undefined || afecta === null) reputacionDesconocida += 1;

    for (const item of orden.items || []) {
      const id = item?.item_id || item?.title || "?";
      const fila = porPublicacion.get(id) || { publicacion: item?.item_id || null, titulo: item?.title || "", cancelaciones: 0, motivos: {}, monto: 0 };
      fila.cancelaciones += 1;
      fila.motivos[motivo] = (fila.motivos[motivo] || 0) + 1;
      fila.monto += Number(orden.total) || 0;
      porPublicacion.set(id, fila);
    }
  }

  const repetidas = [...porPublicacion.values()]
    .filter((fila) => fila.cancelaciones >= 2)
    .sort((a, b) => b.cancelaciones - a.cancelaciones);

  const recomendaciones = [];
  if (porMotivo.vendedor) {
    recomendaciones.push({
      prioridad: "alta",
      texto: `${porMotivo.vendedor} cancelación(es) hechas por el vendedor: antes de publicar, confirma existencia real y precio; si no hay stock, pausa la publicación en vez de cancelar la venta.`,
    });
  }
  if (repetidas.length) {
    recomendaciones.push({
      prioridad: "alta",
      texto: `Revisa ${repetidas.length} publicación(es) canceladas 2 o más veces (precio, existencia, título y fotos): ${repetidas.map((fila) => fila.titulo).join("; ")}.`,
    });
  }
  if (porMotivo.pago_no_concretado) {
    recomendaciones.push({
      prioridad: "media",
      texto: `${porMotivo.pago_no_concretado} orden(es) sin pago concretado: suelen ser pagos en efectivo o tarjeta rechazada; no dependen de la tienda, pero conviene medirlas.`,
    });
  }
  if (porMotivo.sin_motivo) {
    recomendaciones.push({
      prioridad: "media",
      texto: `${porMotivo.sin_motivo} cancelación(es) sin motivo informado por la plataforma: revisa el detalle de cada venta en Mercado Libre.`,
    });
  }

  const total = lista.filter((orden) => ["paid", "cancelled"].includes(String(orden?.status).toLowerCase())).length;
  return {
    ordenes: total,
    canceladas: canceladas.length,
    tasaPct: total ? Math.round((canceladas.length / total) * 1000) / 10 : null,
    porMotivo,
    afectanReputacion,
    reputacionDesconocida,
    publicacionesRepetidas: repetidas,
    porPublicacion: [...porPublicacion.values()].sort((a, b) => b.cancelaciones - a.cancelaciones),
    recomendaciones,
    nota: "Recomendaciones para revisar; MONYS OS no cancela, pausa ni edita publicaciones.",
  };
}
