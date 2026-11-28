/*
 * DIAGNÓSTICO DE CANCELACIONES · MONYS OS
 *
 * Explica por qué se cancelan las ventas de un marketplace y cuáles dañan
 * la reputación. Entrada: órdenes con la forma de la conexión de Mercado
 * Libre (status, cancel_group, tags, items, fecha) y, opcionalmente,
 * reclamos ({ order_id, afecta_reputacion, reason_familia }).
 *
 * Atribución (con la evidencia disponible en la orden):
 * - vendedor: el vendedor canceló (sin stock, precio o publicación
 *   equivocada). Es la única que la tienda puede evitar directamente.
 * - comprador: el comprador la canceló.
 * - plataforma: la plataforma la detuvo (fraude u otra regla interna).
 * - pago_no_concretado: el comprador no completó el pago.
 * - sin_evidencia: la orden no dice quién canceló.
 * Impacto en reputación: SOLO con evidencia de la plataforma (reclamo con
 * afecta_reputacion). Sin ella queda "desconocido"; no se infiere.
 * Publicación cancelada 2+ veces: revisar existencia, precio y título.
 * Módulo puro.
 */

const GRUPOS = {
  seller: "vendedor",
  buyer: "comprador",
  fraud: "plataforma",
  internal: "plataforma",
};

export const ATRIBUIBLE_AL_VENDEDOR = new Set(["vendedor"]);

function clasificar(orden) {
  const grupo = GRUPOS[orden?.cancel_group];
  if (grupo) return grupo;
  const tags = new Set(orden?.tags || []);
  if (tags.has("fraud_risk_detected")) return "plataforma";
  if (tags.has("not_paid")) return "pago_no_concretado";
  return "sin_evidencia";
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
  let noAfectanReputacion = 0;
  let reputacionDesconocida = 0;

  for (const orden of canceladas) {
    const motivo = clasificar(orden);
    porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;

    const afecta = reputacionPorOrden.get(String(orden.id));
    if (afecta === "affected") afectanReputacion += 1;
    else if (afecta === "not_affected" || afecta === "not_applies") noAfectanReputacion += 1;
    else reputacionDesconocida += 1;

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
      texto: `${porMotivo.vendedor} cancelación(es) atribuibles al vendedor: antes de publicar, confirma existencia real y precio; si no hay stock, pausa la publicación en vez de cancelar la venta.`,
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
  if (porMotivo.sin_evidencia) {
    recomendaciones.push({
      prioridad: "media",
      texto: `${porMotivo.sin_evidencia} cancelación(es) sin evidencia de quién canceló: revisa el detalle de cada venta en la plataforma.`,
    });
  }

  const total = lista.filter((orden) => ["paid", "cancelled"].includes(String(orden?.status).toLowerCase())).length;
  return {
    ordenes: total,
    canceladas: canceladas.length,
    tasaPct: total ? Math.round((canceladas.length / total) * 1000) / 10 : null,
    porMotivo,
    atribuiblesAlVendedor: porMotivo.vendedor || 0,
    noAtribuiblesAlVendedor: canceladas.length - (porMotivo.vendedor || 0),
    reputacion: {
      afecta: afectanReputacion,
      noAfecta: noAfectanReputacion,
      desconocido: reputacionDesconocida,
      nota: "Solo se cuenta con evidencia de la plataforma; no se infiere.",
    },
    publicacionesRepetidas: repetidas,
    porPublicacion: [...porPublicacion.values()].sort((a, b) => b.cancelaciones - a.cancelaciones),
    recomendaciones,
    nota: "Recomendaciones para revisar; MONYS OS no cancela, pausa ni edita publicaciones.",
  };
}
