import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  CAMPOS_TIKTOK_POR_VERIFICAR,
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
  assert.deepEqual(fila.items[0], { publicacion: "MLM1", titulo: "Polvo", sku: "POLVO-70", cantidad: 2, precio_unit: 219, comision: 61.32 });
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
  assert.deepEqual(p, { canal: "mercado_libre", publicacion: "MLM1", titulo: "Polvo", sku: "POLVO-70", codigo_barras: "7501234567890", estado: "active", precio: 279, existencia: 18, vendidas: 2 });
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
