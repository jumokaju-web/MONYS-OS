import test from "node:test";
import assert from "node:assert/strict";
import { consolidarCanales, resumirOrdenesMarketplace } from "../../src/core/canales/rentabilidadMarketplace.js";

// Datos SINTÉTICOS con la misma forma que entrega la conexión de Mercado
// Libre (el repositorio es público: no se suben ventas reales).
const orden = (id, extra = {}) => ({
  id,
  fecha: "2026-11-20T10:00:00.000-06:00",
  status: "paid",
  total: 200,
  comision_total: 28,
  costo_envio_vendedor: 40,
  envio_estado: "ok",
  money_release_date: "2026-12-10T10:00:00.000-06:00",
  items: [{ item_id: `MLM${id}`, title: "Polvo compacto", sku: "POLVO-1", cantidad: 1, precio_unit: 200, sale_fee_total: 28 }],
  ...extra,
});

const ordenes = [
  orden(1),
  orden(2, {
    total: 400, comision_total: 56, costo_envio_vendedor: 150, money_release_date: "2026-11-25T10:00:00.000-06:00",
    items: [{ item_id: "MLM2", title: "Polvo compacto", sku: "polvo-1 ", cantidad: 2, precio_unit: 200, sale_fee_total: 56 }],
  }),
  orden(3, {
    total: 100, comision_total: 14, costo_envio_vendedor: 20,
    items: [{ item_id: "MLM3", title: "Perfilador", sku: null, cantidad: 1, precio_unit: 100, sale_fee_total: 14 }],
  }),
  orden(4, { status: "cancelled", cancel_group: "seller", total: 300 }),
  orden(5, { status: "cancelled", cancel_group: "fraud", total: 120 }),
  orden(6, { status: "cancelled", total: 250 }),
];

test("separa ventas pagadas de canceladas y calcula cargos de la plataforma", () => {
  const r = resumirOrdenesMarketplace(ordenes, { hoy: "2026-11-27T12:00:00Z" });
  assert.equal(r.ventasPagadas, 700);
  assert.equal(r.ordenesPagadas, 3);
  assert.equal(r.unidades, 4);
  assert.equal(r.comisiones, 98);
  assert.equal(r.envios, 210);
  assert.equal(r.cargosPct, 44); // (98 + 210) ÷ 700
  assert.equal(r.netoAntesRetenciones, 392);
  assert.deepEqual(r.canceladas, {
    ordenes: 3, monto: 670,
    porMotivo: { "cancelada por el vendedor": 1, "riesgo de fraude": 1, "sin motivo informado": 1 },
  });
  assert.equal(r.tasaCancelacionPct, 50);
});

test("depósitos: liberado y pendiente son caja, no venta", () => {
  const r = resumirOrdenesMarketplace(ordenes, { hoy: "2026-11-27T12:00:00Z" });
  assert.equal(r.flujo.liberado, 194); // orden 2: 400 − 56 − 150
  assert.equal(r.flujo.pendienteDeLiberar, 198); // 132 + 66
});

test("sin % de retenciones ni costo SICAR no hay utilidad, y se dice qué falta", () => {
  const r = resumirOrdenesMarketplace(ordenes, { hoy: "2026-11-27T12:00:00Z" });
  assert.equal(r.retenciones, null);
  assert.equal(r.utilidad, null);
  assert.ok(r.faltantes.some((texto) => texto.includes("retenciones")));
  assert.ok(r.faltantes.some((texto) => texto.includes("costo de SICAR")));
  const sinSku = r.porSku.find((fila) => fila.sku === null);
  assert.match(sinSku.motivo, /sin SKU/);
});

test("utilidad por SKU con costo SICAR y retenciones; detecta productos con pérdida", () => {
  const r = resumirOrdenesMarketplace(ordenes.slice(0, 2), {
    hoy: "2026-11-27T12:00:00Z",
    costosPorSku: { "POLVO-1": 110 },
    retencionPct: 9,
  });
  const polvo = r.porSku[0];
  assert.equal(polvo.sku, "POLVO-1"); // normaliza mayúsculas y espacios
  assert.equal(polvo.unidades, 3);
  assert.equal(polvo.venta, 600);
  assert.equal(polvo.envio, 190);
  // 600 − 84 comisión − 190 envío − 54 retención − 330 costo
  assert.equal(polvo.utilidad, -58);
  assert.equal(polvo.pierdeDinero, true);
  assert.equal(r.productosConPerdida.length, 1);
  assert.equal(r.utilidad, -58);
  assert.equal(r.retenciones, 54);
});

test("envío desconocido no se asume cero", () => {
  const r = resumirOrdenesMarketplace([orden(9, { costo_envio_vendedor: null, envio_estado: "sin_dato" })]);
  assert.equal(r.envios, null);
  assert.equal(r.netoAntesRetenciones, null);
  assert.equal(r.flujo.pendienteDeLiberar, null);
  assert.equal(r.porSku[0].envio, null);
});

test("el envío de una orden con varios renglones se reparte por importe", () => {
  const r = resumirOrdenesMarketplace([orden(10, {
    total: 300, comision_total: 42, costo_envio_vendedor: 60,
    items: [
      { item_id: "A", sku: "A", cantidad: 1, precio_unit: 200, sale_fee_total: 28 },
      { item_id: "B", sku: "B", cantidad: 1, precio_unit: 100, sale_fee_total: 14 },
    ],
  })]);
  assert.deepEqual(r.porSku.map((fila) => fila.envio), [40, 20]);
});

test("consolidado: no duplica canales registrados en SICAR y pide confirmación si no se sabe", () => {
  const pendiente = consolidarCanales({ ventaSicar: 100000, canales: [{ canal: "mercado_libre", ventasPagadas: 1000, registradoEnSicar: null }] });
  assert.equal(pendiente.ventaTotal, null);
  assert.ok(pendiente.faltantes[0].includes("mercado_libre"));

  const separado = consolidarCanales({ ventaSicar: 100000, canales: [
    { canal: "mercado_libre", ventasPagadas: 1000, registradoEnSicar: false },
    { canal: "tiktok_shop", ventasPagadas: 500, registradoEnSicar: true },
  ] });
  assert.equal(separado.ventaTotal, 101000);
  assert.equal(separado.participacion.tiktok_shop, null);
});
