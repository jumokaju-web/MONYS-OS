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
      // Variantes (color, tono) de una misma publicación no deben chocar.
      variacion: linea?.item?.variation_id ? String(linea.item.variation_id) : "",
      titulo: linea?.item?.title || null,
      sku: linea?.item?.seller_sku || linea?.item?.seller_custom_field || "",
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
    datos_origen: {
      shipping_id: orden?.shipping?.id ?? null,
      pack_id: orden?.pack_id ?? null,
      tags: orden?.tags || [],
      money_release_status: pago?.money_release_status ?? null,
    },
    items,
  };
}

/*
 * item: elemento de GET /items?ids=... (body). Devuelve una fila por
 * variante (o una sola si no tiene), cada una con su SKU y existencia.
 */
export function publicacionesMercadoLibre(item) {
  const atributo = (lista, id) => (lista || []).find((a) => a?.id === id)?.value_name || null;
  const base = {
    canal: "mercado_libre",
    publicacion: item?.id,
    titulo: item?.title || null,
    estado: item?.status || null,
  };
  const variaciones = item?.variations || [];
  if (!variaciones.length) {
    return [{
      ...base,
      variacion: "",
      sku: atributo(item?.attributes, "SELLER_SKU") || item?.seller_custom_field || null,
      codigo_barras: atributo(item?.attributes, "GTIN"),
      precio: numero(item?.price),
      existencia: numero(item?.available_quantity),
      vendidas: numero(item?.sold_quantity),
    }];
  }
  return variaciones.map((variacion) => ({
    ...base,
    variacion: String(variacion?.id),
    sku: atributo(variacion?.attributes, "SELLER_SKU") || variacion?.seller_custom_field || null,
    codigo_barras: atributo(variacion?.attributes, "GTIN") || atributo(item?.attributes, "GTIN"),
    precio: numero(variacion?.price ?? item?.price),
    existencia: numero(variacion?.available_quantity),
    vendidas: numero(variacion?.sold_quantity),
  }));
}

/* Compatibilidad: primera (o única) fila de la publicación. */
export function publicacionMercadoLibre(item) {
  return publicacionesMercadoLibre(item)[0];
}

/*
 * Liquidaciones de Mercado Libre derivadas de las órdenes pagadas: cada
 * venta libera su neto en money_release_date. Es la fuente disponible con
 * permisos de solo lectura de ML; el depósito bancario real se concilia en
 * Tesorería (liquidacion_marketplace). Sin envío conocido el neto es null.
 */
export function liquidacionesDesdeOrdenesML(ordenes = [], { hoy = null } = {}) {
  const referencia = hoy ? new Date(hoy) : new Date();
  return (ordenes || [])
    .filter((orden) => orden.estado === "paid" && orden.fecha_liberacion)
    .map((orden) => {
      const neto = orden.envio_vendedor === null || orden.comision === null
        ? null
        : Math.round((orden.total - orden.comision - orden.envio_vendedor) * 100) / 100;
      const liberada = orden.datos_origen?.money_release_status === "released";
      return {
        canal: "mercado_libre",
        external_id: `orden:${orden.external_id}`,
        fecha: orden.fecha_liberacion,
        monto_bruto: orden.total,
        comisiones: orden.comision,
        envios: orden.envio_vendedor,
        retenciones: null,
        devoluciones: null,
        monto_neto: neto,
        estado: liberada ? "liberada" : new Date(orden.fecha_liberacion) <= referencia ? "liberable_sin_confirmar" : "pendiente",
        datos_origen: { derivada_de_orden: true, money_release_status: orden.datos_origen?.money_release_status ?? null },
      };
    });
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
    const clave = `${linea?.product_id}:${linea?.sku_id || ""}:${linea?.seller_sku || ""}`;
    const fila = porSku.get(clave) || {
      publicacion: linea?.product_id || null,
      variacion: linea?.sku_id ? String(linea.sku_id) : "",
      titulo: linea?.product_name || null,
      sku: linea?.seller_sku || "",
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
 * producto: elemento de POST /product/202309/products/search
 * (data.products[]). Una fila por SKU (variante). Los nombres de campos se
 * deben confirmar contra la documentación oficial al registrar la app.
 */
export function publicacionesTikTokShop(producto) {
  return (producto?.skus || []).map((sku) => ({
    canal: "tiktok_shop",
    publicacion: String(producto?.id),
    variacion: sku?.id ? String(sku.id) : "",
    titulo: producto?.title || null,
    sku: sku?.seller_sku || null,
    codigo_barras: null,
    estado: producto?.status || null,
    precio: numero(sku?.price?.sale_price),
    existencia: (sku?.inventory || []).reduce((suma, almacen) => suma + (numero(almacen?.quantity) ?? 0), 0),
    vendidas: null,
  }));
}

/*
 * Credenciales guardadas por cuenta (JSON en Vault):
 * { access_token, access_expira (ISO), refresh_token, refresh_expira, shop_cipher }
 * ¿Hace falta renovar? Con 10 minutos de margen.
 */
export function credencialVigente(credencial, ahora = new Date()) {
  const expira = new Date(credencial?.access_expira || 0);
  return Boolean(credencial?.access_token) && expira.getTime() - 10 * 60_000 > new Date(ahora).getTime();
}

/*
 * Respuesta de renovación de TikTok Shop
 * (GET https://auth.tiktok-shops.com/api/v2/token/refresh): data con
 * access_token, access_token_expire_in (epoch s), refresh_token,
 * refresh_token_expire_in (epoch s).
 */
export function credencialDesdeRenovacionTikTok(respuesta, anterior = {}) {
  const datos = respuesta?.data || {};
  if (!datos.access_token || !datos.refresh_token) return null;
  return {
    ...anterior,
    access_token: datos.access_token,
    access_expira: new Date(Number(datos.access_token_expire_in) * 1000).toISOString(),
    refresh_token: datos.refresh_token,
    refresh_expira: new Date(Number(datos.refresh_token_expire_in) * 1000).toISOString(),
  };
}

/*
 * Respuesta de renovación de Mercado Libre (POST /oauth/token): access_token,
 * expires_in (segundos), refresh_token (rota en cada uso).
 */
export function credencialDesdeRenovacionML(respuesta, anterior = {}, ahora = new Date()) {
  if (!respuesta?.access_token || !respuesta?.refresh_token) return null;
  return {
    ...anterior,
    access_token: respuesta.access_token,
    access_expira: new Date(new Date(ahora).getTime() + Number(respuesta.expires_in || 0) * 1000).toISOString(),
    refresh_token: respuesta.refresh_token,
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
