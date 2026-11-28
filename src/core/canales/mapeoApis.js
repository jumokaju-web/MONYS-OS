/*
 * TRADUCCIÓN DE LAS APIS OFICIALES A LAS TABLAS canal_* · MONYS OS
 *
 * Funciones puras que convierten respuestas de la API de Mercado Libre y
 * de la TikTok Shop Partner API (versión 202309) en filas de canal_*.
 * Las usa la Edge Function `sincronizar-canales`; aquí se pueden probar.
 *
 * Regla: lo que la API no trae queda null, nunca 0.
 */

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

/* ---------------- Mercado Libre ---------------- */

const ESTADOS_ML = { paid: "paid", cancelled: "cancelled", payment_required: "pending", payment_in_process: "pending", confirmed: "pending" };

/*
 * orden: elemento de GET /orders/search (results[]).
 * costoEnvio: senders[0].cost de GET /shipments/{id}/costs, o null.
 */
export function ordenMercadoLibre(orden, { costoEnvio = null } = {}) {
  const items = (orden?.order_items || []).map((linea) => {
    const cantidad = numero(linea?.quantity) ?? 0;
    const comisionUnitaria = numero(linea?.sale_fee);
    return {
      publicacion: linea?.item?.id || null,
      titulo: linea?.item?.title || null,
      sku: linea?.item?.seller_sku || linea?.item?.seller_custom_field || null,
      cantidad,
      precio_unit: numero(linea?.unit_price) ?? 0,
      // sale_fee de ML es POR UNIDAD.
      comision: comisionUnitaria === null ? null : Math.round(comisionUnitaria * cantidad * 100) / 100,
    };
  });
  const comisiones = items.map((item) => item.comision);
  const pago = (orden?.payments || []).find((p) => p?.money_release_date) || null;
  const estado = ESTADOS_ML[orden?.status] || "other";
  return {
    canal: "mercado_libre",
    external_id: String(orden?.id),
    fecha: orden?.date_created,
    estado,
    motivo_cancelacion: estado === "cancelled" ? orden?.cancel_detail?.group || null : null,
    total: numero(orden?.total_amount) ?? 0,
    comision: comisiones.some((valor) => valor === null) ? null : Math.round(comisiones.reduce((a, b) => a + b, 0) * 100) / 100,
    envio_vendedor: estado === "cancelled" ? null : numero(costoEnvio),
    envio_estado: estado === "cancelled" ? "no_aplica_cancelada" : costoEnvio === null ? "sin_dato" : "ok",
    fecha_liberacion: pago?.money_release_date || null,
    registrado_en_sicar: false,
    datos_origen: { shipping_id: orden?.shipping?.id ?? null, pack_id: orden?.pack_id ?? null, tags: orden?.tags || [] },
    items,
  };
}

/* item: elemento de GET /items?ids=... (body). */
export function publicacionMercadoLibre(item) {
  const atributo = (id) => (item?.attributes || []).find((a) => a?.id === id)?.value_name || null;
  return {
    canal: "mercado_libre",
    publicacion: item?.id,
    titulo: item?.title || null,
    sku: atributo("SELLER_SKU") || item?.seller_custom_field || null,
    codigo_barras: atributo("GTIN"),
    estado: item?.status || null,
    precio: numero(item?.price),
    existencia: numero(item?.available_quantity),
    vendidas: numero(item?.sold_quantity),
  };
}

/* ---------------- TikTok Shop (Partner API 202309) ---------------- */

const ESTADOS_TT = {
  UNPAID: "pending",
  ON_HOLD: "pending",
  AWAITING_SHIPMENT: "paid",
  PARTIALLY_SHIPPING: "paid",
  AWAITING_COLLECTION: "paid",
  IN_TRANSIT: "paid",
  DELIVERED: "paid",
  COMPLETED: "paid",
  CANCELLED: "cancelled",
};

/* orden: elemento de POST /order/202309/orders/search (data.orders[]). */
export function ordenTikTokShop(orden) {
  const estado = ESTADOS_TT[orden?.status] || "other";
  const porSku = new Map();
  for (const linea of orden?.line_items || []) {
    const clave = `${linea?.product_id}:${linea?.seller_sku || linea?.sku_id}`;
    const fila = porSku.get(clave) || {
      publicacion: linea?.product_id || null,
      titulo: linea?.product_name || null,
      sku: linea?.seller_sku || null,
      cantidad: 0,
      precio_unit: numero(linea?.sale_price) ?? 0,
      // La comisión de TikTok llega en los estados de cuenta, no en la orden.
      comision: null,
    };
    fila.cantidad += 1; // TikTok devuelve un line_item por unidad.
    porSku.set(clave, fila);
  }
  const fecha = numero(orden?.create_time);
  return {
    canal: "tiktok_shop",
    external_id: String(orden?.id),
    fecha: fecha === null ? null : new Date(fecha * 1000).toISOString(),
    estado,
    motivo_cancelacion: estado === "cancelled" ? orden?.cancel_reason || orden?.cancellation_initiator || null : null,
    total: numero(orden?.payment?.total_amount) ?? 0,
    comision: null,
    envio_vendedor: null,
    envio_estado: "sin_dato",
    fecha_liberacion: null,
    registrado_en_sicar: false,
    datos_origen: { status: orden?.status || null },
    items: [...porSku.values()],
  };
}

/*
 * Detalle de cargos por orden (statement transactions): los nombres de
 * campos cambian entre versiones (202309 / 202501) y NO se verificaron
 * contra la documentación oficial. Queda pendiente al registrar la app:
 * hasta entonces la comisión, el envío y las retenciones de TikTok por
 * orden quedan null (no se asumen).
 */
export const CAMPOS_TIKTOK_POR_VERIFICAR = Object.freeze([
  "comisión de plataforma por orden",
  "costo de envío por orden",
  "retenciones de impuestos por orden",
  "devoluciones y reembolsos por orden",
]);

/*
 * statement: elemento de GET /finance/202309/statements (data.statements[]).
 * Campos confirmados en referencias públicas de la API: revenue_amount,
 * fee_amount, shipping_cost_amount, settlement_amount, statement_time,
 * payment_status, currency.
 */
export function liquidacionTikTokShop(statement) {
  const fecha = numero(statement?.statement_time);
  return {
    canal: "tiktok_shop",
    external_id: String(statement?.id),
    fecha: fecha === null ? null : new Date(fecha * 1000).toISOString(),
    monto_bruto: numero(statement?.revenue_amount),
    comisiones: numero(statement?.fee_amount) === null ? null : Math.abs(numero(statement.fee_amount)),
    envios: numero(statement?.shipping_cost_amount) === null ? null : Math.abs(numero(statement.shipping_cost_amount)),
    retenciones: null,
    devoluciones: null,
    monto_neto: numero(statement?.settlement_amount),
    estado: statement?.payment_status || null,
    datos_origen: { currency: statement?.currency || null },
  };
}

/*
 * Firma de la TikTok Shop Partner API:
 * HMAC-SHA256(app_secret, app_secret + path + params ordenados (sin sign
 * ni access_token) + body + app_secret), en hexadecimal.
 * Devuelve el texto a firmar; el HMAC lo calcula quien llama (Web Crypto
 * en Deno, crypto en Node), para mantener este módulo puro.
 */
export function cadenaFirmaTikTok({ path, params = {}, body = "", appSecret }) {
  const ordenados = Object.keys(params)
    .filter((clave) => clave !== "sign" && clave !== "access_token")
    .sort()
    .map((clave) => `${clave}${params[clave]}`)
    .join("");
  return `${appSecret}${path}${ordenados}${body || ""}${appSecret}`;
}
