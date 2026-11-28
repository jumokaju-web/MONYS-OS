/*
 * CONCILIACIÓN DE PLATAFORMAS EN TESORERÍA · MONYS OS
 *
 * Decide, por movimiento de Tesorería, cuánto ya está contado en los datos
 * del canal (y por eso NO se vuelve a restar) y cuánto es un cargo
 * distinto. Fuente: cash_movement_platform_links.
 *
 * Un monto se excluye solo si el vínculo:
 * - está verificado,
 * - es de una cuenta de canal del mismo negocio presente en el estado,
 * - es de un tipo que el estado ya resta desde las órdenes (comisión o
 *   envío) y el canal trae ese dato,
 * - y su referencia existe en las operaciones del canal del periodo.
 * Todo lo demás (propuesto, sin referencia, tipo distinto) sigue contando
 * como cargo y queda por conciliar. Conciliación parcial permitida.
 * Módulo puro.
 */

const TIPOS_RESTADOS_EN_ORDENES = Object.freeze({ comision: "comisiones", envio: "envios" });

const r2 = (v) => Math.round(v * 100) / 100;
function numero(v) {
  if (v === null || v === undefined || typeof v === "boolean" || typeof v === "object" || (typeof v === "string" && !v.trim())) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/*
 * movimiento: { id, amount, business_id }
 * vinculos:   filas de cash_movement_platform_links del movimiento.
 * canales:    [{ cuentaId, operaciones:Set|array, gastosVentaBase:{comisiones, envios} }]
 */
export function conciliarMovimientoPlataforma(movimiento, vinculos = [], canales = [], { businessId } = {}) {
  const monto = Math.abs(numero(movimiento?.amount) ?? 0);
  const detalle = [];
  let excluido = 0;
  for (const v of vinculos || []) {
    if (String(v?.cash_movement_id) !== String(movimiento?.id) || v?.estado === "anulado") continue;
    const importe = numero(v?.monto_conciliado);
    if (importe === null || importe <= 0) continue;
    const canal = (canales || []).find((c) => String(c.cuentaId) === String(v.cuenta_id));
    const operaciones = canal ? new Set([...(canal.operaciones || [])].map(String)) : new Set();
    const campo = TIPOS_RESTADOS_EN_ORDENES[v.tipo_operacion];
    let motivo = null;
    if (businessId && String(v.business_id) !== String(businessId)) motivo = "vínculo de otro negocio";
    else if (v.estado !== "verificado") motivo = "vínculo sin verificar";
    else if (!canal) motivo = "cuenta de canal sin datos en este estado";
    else if (!campo) motivo = `tipo ${v.tipo_operacion}: no viene restado en las órdenes`;
    else if (canal.gastosVentaBase?.[campo] === null || canal.gastosVentaBase?.[campo] === undefined) motivo = `el canal no trae ${campo}`;
    else if (!v.referencia_externa || !operaciones.has(String(v.referencia_externa))) motivo = "la referencia no está en las operaciones del periodo";
    const aplicado = motivo ? 0 : Math.min(importe, Math.max(0, monto - excluido));
    excluido += aplicado;
    detalle.push({ vinculoId: v.id ?? null, cuentaId: v.cuenta_id, tipo: v.tipo_operacion, referencia: v.referencia_externa ?? null, importe: r2(importe), excluido: r2(aplicado), motivo });
  }
  const restante = r2(Math.max(0, monto - excluido));
  return {
    movimientoId: movimiento?.id ?? null,
    monto: r2(monto),
    excluido: r2(excluido),
    restante,
    estado: excluido === 0 ? "sin_conciliar" : restante === 0 ? "conciliado" : "parcial",
    // A qué canal cargar el restante: la cuenta del primer vínculo con datos.
    cuentaDelRestante: detalle.find((d) => (canales || []).some((c) => String(c.cuentaId) === String(d.cuentaId)))?.cuentaId ?? null,
    detalle,
  };
}
