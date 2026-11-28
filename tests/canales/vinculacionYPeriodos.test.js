import test from "node:test";
import assert from "node:assert/strict";
import { ESTADOS_VINCULO, vincularPublicaciones } from "../../src/core/canales/vinculacionSicar.js";
import { diagnosticarCancelaciones } from "../../src/core/canales/diagnosticoCancelaciones.js";
import { clavePeriodo, resultadosPorPeriodo } from "../../src/core/canales/resultadosPeriodicos.js";
import { resumirOrdenesMarketplace } from "../../src/core/canales/rentabilidadMarketplace.js";

// Datos SINTÉTICOS (el repositorio es público).
const sicar = [
  { codigo: "POLVO-70", codigo_barras: "7501234567890", descripcion: "Polvo compacto flawless 7.0", costo: 120 },
  { codigo: "BASE-45", codigo_barras: "0012345678905", descripcion: "Base liquida flawless 4.5", costo: 150 },
  { codigo: "RIMEL-X", codigo_barras: "", descripcion: "Rimel waterproof volumen", costo: 0 },
  { codigo: "DUP", codigo_barras: "7500000000001", descripcion: "Gloss labial", costo: 50 },
  { codigo: "DUP", codigo_barras: "7500000000002", descripcion: "Gloss labial otro", costo: 55 },
];

/* ---------- Vinculación con SICAR ---------- */

test("vincula por SKU, por código de barras y manualmente; nunca inventa costos", () => {
  const { publicaciones, resumen, costosPorPublicacion, pendientes } = vincularPublicaciones({
    productosSicar: sicar,
    vinculosManuales: [{ canal: "mercado_libre", publicacion: "P5", codigo_sicar: "base-45" }],
    publicaciones: [
      { canal: "mercado_libre", publicacion: "P1", titulo: "Polvo 7.0", sku: " polvo-70 " },
      { canal: "mercado_libre", publicacion: "P2", titulo: "Base 4.5", sku: null, codigo_barras: "12345678905" }, // UPC sin cero
      { canal: "mercado_libre", publicacion: "P3", titulo: "Rimel waterproof volumen set", sku: "RIMEL-X" },
      { canal: "mercado_libre", publicacion: "P4", titulo: "Polvo compacto flawless 7.0 original", sku: null },
      { canal: "mercado_libre", publicacion: "P5", titulo: "Kit", sku: "OTRO" },
      { canal: "tiktok_shop", publicacion: "T1", titulo: "Gloss", sku: "DUP" },
    ],
  });
  const estado = Object.fromEntries(publicaciones.map((fila) => [fila.publicacion, fila]));
  assert.equal(estado.P1.estado, ESTADOS_VINCULO.SKU);
  assert.equal(estado.P1.costoUnitario, 120);
  assert.equal(estado.P2.estado, ESTADOS_VINCULO.CODIGO_BARRAS);
  assert.equal(estado.P2.costoUnitario, 150);
  // Vinculado, pero sin costo en SICAR: no se asume.
  assert.equal(estado.P3.codigoSicar, "RIMEL-X");
  assert.equal(estado.P3.costoUnitario, null);
  assert.match(estado.P3.motivo, /no tiene costo/);
  // Sin SKU ni código: por vincular, con sugerencia que una persona confirma.
  assert.equal(estado.P4.estado, ESTADOS_VINCULO.POR_VINCULAR);
  assert.equal(estado.P4.costoUnitario, null);
  assert.equal(estado.P4.sugerencias[0].codigo, "POLVO-70");
  assert.equal(estado.P5.estado, ESTADOS_VINCULO.MANUAL);
  assert.equal(estado.P5.costoUnitario, 150);
  assert.equal(estado.T1.estado, ESTADOS_VINCULO.AMBIGUO);
  assert.equal(estado.T1.costoUnitario, null);
  assert.equal(estado.T1.sugerencias.length, 2);
  assert.deepEqual(costosPorPublicacion, { P1: 120, P2: 150, P5: 150 });
  assert.deepEqual(resumen, { total: 6, vinculadas: 4, conCosto: 3, porVincular: 2 });
  assert.equal(pendientes.length, 3);
});

test("el costo vinculado por publicación alimenta la rentabilidad aunque no haya SKU", () => {
  const { costosPorPublicacion } = vincularPublicaciones({
    productosSicar: sicar,
    publicaciones: [{ canal: "mercado_libre", publicacion: "P2", titulo: "Base", sku: null, codigo_barras: "0012345678905" }],
  });
  const r = resumirOrdenesMarketplace([{
    id: 1, status: "paid", total: 289, comision_total: 40, costo_envio_vendedor: 35, envio_estado: "ok",
    money_release_date: "2026-12-01", items: [{ item_id: "P2", sku: null, cantidad: 1, precio_unit: 289, sale_fee_total: 40 }],
  }], { costosPorPublicacion, retencionPct: 0 });
  assert.equal(r.porSku[0].costoProducto, 150);
  assert.equal(r.porSku[0].utilidad, 289 - 40 - 35 - 150);
});

/* ---------- Diagnóstico de cancelaciones ---------- */

const cancelada = (id, item, extra = {}) => ({ id, status: "cancelled", total: 299, items: [{ item_id: item, title: `Publicación ${item}` }], ...extra });

test("diagnostica cancelaciones por motivo, reputación y publicaciones repetidas", () => {
  const diagnostico = diagnosticarCancelaciones(
    [
      { id: 1, status: "paid", total: 219, items: [] },
      cancelada(2, "A", { cancel_group: "seller" }),
      cancelada(3, "A", { tags: ["not_paid"] }),
      cancelada(4, "B", { tags: ["fraud_risk_detected", "not_paid"] }),
      cancelada(5, "C", {}),
    ],
    { reclamos: [{ order_id: 2, afecta_reputacion: "affected" }, { order_id: 3, afecta_reputacion: "not_affected" }] }
  );
  assert.equal(diagnostico.canceladas, 4);
  assert.equal(diagnostico.tasaPct, 80);
  assert.deepEqual(diagnostico.porMotivo, { vendedor: 1, pago_no_concretado: 1, fraude: 1, sin_motivo: 1 });
  assert.equal(diagnostico.afectanReputacion, 1);
  assert.equal(diagnostico.reputacionDesconocida, 2);
  assert.equal(diagnostico.publicacionesRepetidas[0].publicacion, "A");
  assert.equal(diagnostico.recomendaciones[0].prioridad, "alta");
  assert.match(diagnostico.nota, /no cancela, pausa ni edita/);
});

/* ---------- Resultados periódicos ---------- */

test("claves de periodo en hora de Ciudad de México; semanas de lunes a domingo", () => {
  assert.equal(clavePeriodo("2026-12-01T03:00:00Z", "dia"), "2026-11-30");
  assert.equal(clavePeriodo("2026-11-29T18:00:00-06:00", "semana"), "2026-11-23"); // domingo
  assert.equal(clavePeriodo("2026-11-30T10:00:00-06:00", "semana"), "2026-11-30"); // lunes
  assert.equal(clavePeriodo("2026-12-01T03:00:00Z", "mes"), "2026-11");
  assert.equal(clavePeriodo("fecha mala", "mes"), null);
});

test("resultados por mes, por canal y consolidado de Monys Glam sin duplicar SICAR", () => {
  const orden = (id, fecha, total) => ({
    id, fecha, status: "paid", total, comision_total: total * 0.14, costo_envio_vendedor: 30, envio_estado: "ok",
    money_release_date: "2026-12-30", items: [{ item_id: `P${id}`, sku: "POLVO-70", cantidad: 1, precio_unit: total, sale_fee_total: total * 0.14 }],
  });
  const r = resultadosPorPeriodo({
    granularidad: "mes",
    canales: {
      mercado_libre: { ordenes: [orden(1, "2026-10-20T12:00:00-06:00", 200), orden(2, "2026-11-20T12:00:00-06:00", 300)], opciones: { costosPorSku: { "POLVO-70": 100 }, retencionPct: 0 } },
      tiktok_shop: { ordenes: [orden(3, "2026-11-21T12:00:00-06:00", 100)], opciones: { retencionPct: 0 } },
    },
    ventasSicarPorPeriodo: { "2026-09": 90000, "2026-10": 100000, "2026-11": 110000 },
  });
  assert.deepEqual(r.periodos.map((p) => p.periodo), ["2026-09", "2026-10", "2026-11"]);
  const nov = r.periodos[2];
  assert.equal(nov.porCanal.mercado_libre.ventasPagadas, 300);
  assert.equal(nov.porCanal.tiktok_shop.ventasPagadas, 100);
  assert.equal(nov.ventaCanales, 400);
  assert.equal(nov.consolidadoMonysGlam.ventaTotal, 110400);
  assert.equal(nov.utilidadCanales, null); // TikTok sin costo vinculado
  // Septiembre: sin órdenes de canales, la utilidad no se presenta como cero.
  assert.equal(r.periodos[0].utilidadCanales, null);
  assert.equal(r.periodos[0].consolidadoMonysGlam.ventaTotal, 90000);
});
