import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  CAMPOS_TIKTOK_POR_VERIFICAR,
  credencialDesdeRenovacionML,
  credencialDesdeRenovacionTikTok,
  credencialVigente,
  liquidacionesDesdeOrdenesML,
  publicacionesMercadoLibre,
  publicacionesTikTokShop,
  cadenaFirmaTikTok,
  liquidacionTikTokShop,
  ordenMercadoLibre,
  ordenTikTokShop,
  publicacionMercadoLibre,
} from "../../src/core/canales/mapeoApis.js";
import { resumirOrdenesMarketplace } from "../../src/core/canales/rentabilidadMarketplace.js";

// Respuestas SINTÉTICAS con la forma de las APIs oficiales.
const ordenML = {
  id: 2000000000000001,
  status: "paid",
  date_created: "2026-11-25T20:39:51.000-04:00",
  total_amount: 438,
  shipping: { id: 48600000001 },
  pack_id: 2000016000000001,
  tags: ["paid", "pack_order"],
  payments: [{ id: 1, money_release_date: "2026-12-26T09:58:17.000-04:00" }],
  order_items: [{ item: { id: "MLM1", title: "Polvo", seller_sku: "POLVO-70" }, quantity: 2, unit_price: 219, sale_fee: 30.66 }],
};

test("Mercado Libre: comisión por unidad × cantidad, envío desconocido como null", () => {
  const fila = ordenMercadoLibre(ordenML, { costoEnvio: 152 });
  assert.equal(fila.external_id, "2000000000000001");
  assert.equal(fila.estado, "paid");
  assert.equal(fila.comision, 61.32);
  assert.equal(fila.envio_vendedor, 152);
  assert.equal(fila.fecha_liberacion, "2026-12-26T09:58:17.000-04:00");
  assert.equal(fila.registrado_en_sicar, false);
  assert.deepEqual(fila.items[0], { publicacion: "MLM1", variacion: "", titulo: "Polvo", sku: "POLVO-70", cantidad: 2, precio_unit: 219, comision: 61.32 });
  assert.equal(ordenMercadoLibre(ordenML).envio_vendedor, null);
  assert.equal(ordenMercadoLibre(ordenML).envio_estado, "sin_dato");
  const cancelada = ordenMercadoLibre({ ...ordenML, status: "cancelled", cancel_detail: { group: "seller" } }, { costoEnvio: 99 });
  assert.equal(cancelada.motivo_cancelacion, "seller");
  assert.equal(cancelada.envio_vendedor, null);
});

test("Mercado Libre: la fila traducida sirve directo al cálculo de rentabilidad", () => {
  const fila = ordenMercadoLibre(ordenML, { costoEnvio: 152 });
  const r = resumirOrdenesMarketplace([{ ...fila, total: fila.total, comision_total: fila.comision, costo_envio_vendedor: fila.envio_vendedor, money_release_date: fila.fecha_liberacion, status: fila.estado, items: fila.items.map((i) => ({ item_id: i.publicacion, sku: i.sku, cantidad: i.cantidad, precio_unit: i.precio_unit, sale_fee_total: i.comision })) }], { hoy: "2026-11-27" });
  assert.equal(r.netoAntesRetenciones, 224.68);
});

test("Mercado Libre: publicación con SKU, código de barras e inventario", () => {
  const p = publicacionMercadoLibre({
    id: "MLM1", title: "Polvo", status: "active", price: 279, available_quantity: 18, sold_quantity: 2,
    attributes: [{ id: "SELLER_SKU", value_name: "POLVO-70" }, { id: "GTIN", value_name: "7501234567890" }],
  });
  assert.deepEqual(p, { canal: "mercado_libre", publicacion: "MLM1", titulo: "Polvo", estado: "active", variacion: "", sku: "POLVO-70", codigo_barras: "7501234567890", precio: 279, existencia: 18, vendidas: 2 });
  assert.equal(publicacionMercadoLibre({ id: "X", attributes: [] }).codigo_barras, null);
});

test("TikTok Shop: un renglón por unidad se agrupa; cargos por orden quedan null", () => {
  const fila = ordenTikTokShop({
    id: "576000000000000001", status: "COMPLETED", create_time: 1764000000,
    payment: { total_amount: "138" },
    line_items: [
      { product_id: "P1", product_name: "Bálsamo", seller_sku: "BAL-1", sale_price: "69" },
      { product_id: "P1", product_name: "Bálsamo", seller_sku: "BAL-1", sale_price: "69" },
    ],
  });
  assert.equal(fila.estado, "paid");
  assert.equal(fila.total, 138);
  assert.equal(fila.items.length, 1);
  assert.equal(fila.items[0].cantidad, 2);
  assert.equal(fila.comision, null);
  assert.equal(fila.envio_vendedor, null);
  assert.ok(CAMPOS_TIKTOK_POR_VERIFICAR.length >= 3);
});

test("TikTok Shop: estado de cuenta y firma de la API", () => {
  const l = liquidacionTikTokShop({ id: 7, statement_time: 1764000000, revenue_amount: "1000", fee_amount: "-80", shipping_cost_amount: "-50", settlement_amount: "870", payment_status: "PAID", currency: "MXN" });
  assert.equal(l.comisiones, 80);
  assert.equal(l.envios, 50);
  assert.equal(l.monto_neto, 870);
  assert.equal(l.retenciones, null);
  const cadena = cadenaFirmaTikTok({ path: "/order/202309/orders/search", params: { timestamp: "1", app_key: "k", sign: "x", access_token: "t", shop_cipher: "c" }, body: "{}", appSecret: "s" });
  assert.equal(cadena, "s/order/202309/orders/searchapp_keykshop_cipherctimestamp1{}s");
  assert.equal(createHmac("sha256", "s").update(cadena).digest("hex").length, 64);
});

test("Mercado Libre: variantes de una publicación no chocan", () => {
  const filas = publicacionesMercadoLibre({
    id: "MLM9", title: "Base", status: "active", price: 298, attributes: [{ id: "GTIN", value_name: "750" }],
    variations: [
      { id: 11, price: 298, available_quantity: 5, sold_quantity: 1, attributes: [{ id: "SELLER_SKU", value_name: "BASE-100" }] },
      { id: 12, price: 298, available_quantity: 0, sold_quantity: 0, attributes: [{ id: "SELLER_SKU", value_name: "BASE-200" }] },
    ],
  });
  assert.deepEqual(filas.map((f) => [f.variacion, f.sku, f.existencia]), [["11", "BASE-100", 5], ["12", "BASE-200", 0]]);
  const item = ordenMercadoLibre({ ...ordenML, order_items: [{ ...ordenML.order_items[0], item: { ...ordenML.order_items[0].item, variation_id: 12 } }] }).items[0];
  assert.equal(item.variacion, "12");
});

test("Mercado Libre: liquidaciones derivadas de las órdenes (caja, no venta)", () => {
  const ordenes = [
    ordenMercadoLibre(ordenML, { costoEnvio: 152 }),
    ordenMercadoLibre({ ...ordenML, id: 2, payments: [{ money_release_date: "2026-11-20T00:00:00Z", money_release_status: "released" }] }, { costoEnvio: 50 }),
    ordenMercadoLibre({ ...ordenML, id: 3 }), // envío desconocido
    ordenMercadoLibre({ ...ordenML, id: 4, status: "cancelled" }, { costoEnvio: 10 }),
  ];
  const l = liquidacionesDesdeOrdenesML(ordenes, { hoy: "2026-11-27T12:00:00Z" });
  assert.equal(l.length, 3);
  assert.deepEqual(l.map((x) => [x.external_id, x.estado, x.monto_neto]), [
    ["orden:2000000000000001", "pendiente", 224.68],
    ["orden:2", "liberada", 326.68],
    ["orden:3", "pendiente", null],
  ]);
  assert.ok(l.every((x) => x.datos_origen.derivada_de_orden && x.retenciones === null));
});

test("TikTok Shop: productos por SKU con inventario sumado", () => {
  const filas = publicacionesTikTokShop({
    id: "P1", title: "Bálsamo", status: "ACTIVATE",
    skus: [{ id: "S1", seller_sku: "BAL-1", price: { sale_price: "69" }, inventory: [{ quantity: 10 }, { quantity: 4 }] }],
  });
  assert.deepEqual(filas[0], { canal: "tiktok_shop", publicacion: "P1", variacion: "S1", titulo: "Bálsamo", sku: "BAL-1", codigo_barras: null, estado: "ACTIVATE", precio: 69, existencia: 14, vendidas: null });
});

test("credenciales: vigencia con margen y renovación de ambas plataformas", () => {
  const ahora = new Date("2026-11-28T10:00:00Z");
  assert.equal(credencialVigente({ access_token: "a", access_expira: "2026-11-28T10:30:00Z" }, ahora), true);
  assert.equal(credencialVigente({ access_token: "a", access_expira: "2026-11-28T10:05:00Z" }, ahora), false);
  assert.equal(credencialVigente({}, ahora), false);
  const ml = credencialDesdeRenovacionML({ access_token: "n", refresh_token: "r2", expires_in: 21600 }, { refresh_token: "r1" }, ahora);
  assert.deepEqual(ml, { refresh_token: "r2", access_token: "n", access_expira: "2026-11-28T16:00:00.000Z" });
  const tt = credencialDesdeRenovacionTikTok({ data: { access_token: "t", access_token_expire_in: 1764400000, refresh_token: "rt", refresh_token_expire_in: 1770000000 } }, { shop_cipher: "c" });
  assert.equal(tt.shop_cipher, "c");
  assert.equal(tt.refresh_token, "rt");
  assert.equal(credencialDesdeRenovacionML({ access_token: "x" }), null); // sin refresh nuevo no se acepta
});
