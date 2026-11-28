import test from "node:test";
import assert from "node:assert/strict";
import { canalesDelMes } from "../../src/core/canales/canalesDelMes.js";

// Sintético (forma real de las tablas de #170).
const cuentas = [
  { id: "ml1", business_id: "b", canal: "mercado_libre", cuenta_externa: "123", historico_desde: "2026-10-31", ultimo_sync: "2026-12-02T12:00:00Z" },
  { id: "mlX", business_id: "otro", canal: "mercado_libre" },
];
const ordenes = [
  { id: "o1", cuenta_id: "ml1", business_id: "b", external_id: "E1", fecha: "2026-11-23T22:02:59Z", estado: "paid", total: 289, comision: 40.46, envio_vendedor: 35, envio_estado: "ok" },
  { id: "o2", cuenta_id: "ml1", business_id: "b", external_id: "E2", fecha: "2026-11-27T13:57:36Z", estado: "paid", total: 438, comision: 61.32, envio_vendedor: 152, envio_estado: "ok" },
  { id: "o3", cuenta_id: "ml1", business_id: "b", external_id: "E3", fecha: "2026-11-04T16:28:02Z", estado: "cancelled", total: 115, comision: 21.28, motivo_cancelacion: "fraud" },
  { id: "o4", cuenta_id: "ml1", business_id: "b", external_id: "E4", fecha: "2026-10-31T05:59:31Z", estado: "paid", total: 999, comision: 1, envio_vendedor: 1 }, // 30-oct en CDMX
  { id: "o9", cuenta_id: "mlX", business_id: "otro", external_id: "E9", fecha: "2026-11-10T10:00:00Z", estado: "paid", total: 777, comision: 1, envio_vendedor: 1 },
];
const items = [
  { orden_id: "o1", publicacion: "MLM1", variacion: "", titulo: "Base FS 4.5", sku: "", cantidad: 1, precio_unit: 289, comision: 40.46 },
  { orden_id: "o2", publicacion: "MLM2", variacion: "", titulo: "Polvo 7.0", sku: "BC-FSP7.0", cantidad: 2, precio_unit: 219, comision: 61.32 },
];
const publicaciones = [
  { cuenta_id: "ml1", publicacion: "MLM1", variacion: "", sku: "", codigo_barras: "7501234567890", titulo: "Base FS 4.5" },
  { cuenta_id: "ml1", publicacion: "MLM2", variacion: "", sku: "BC-FSP7.0", titulo: "Polvo 7.0" },
];
const productosSicar = [{ codigo: "BC-FSP7.0", costo: 80, descripcion: "Polvo 7.0" }];

test("resumen del canal desde tablas: solo cuentas y órdenes del negocio y del mes", () => {
  const [ml] = canalesDelMes({ businessId: "b", mes: "2026-11", cuentas, ordenes, items, publicaciones, productosSicar, hoy: "2026-12-01" });
  assert.equal(ml.cuentaId, "ml1");
  assert.equal(ml.resumen.ventasPagadas, 727); // E1 + E2; E4 es de octubre en CDMX; E9 es de otro negocio
  assert.deepEqual(ml.operaciones.sort(), ["E1", "E2", "E3"]);
  assert.equal(ml.coberturaCompleta, true);
  // MLM2 tiene costo por SKU; MLM1 queda por vincular (sin SKU ni código en SICAR).
  assert.equal(ml.vinculacion.conCosto, 1);
  assert.equal(ml.porVincular[0].publicacion, "MLM1");
  assert.equal(ml.publicidad, null);
});

test("cobertura: sin historial declarado o con sincronización vieja el mes no está completo", () => {
  const [a] = canalesDelMes({ businessId: "b", mes: "2026-10", cuentas, ordenes, items, publicaciones, productosSicar });
  assert.equal(a.coberturaCompleta, false);
  assert.match(a.motivoCobertura, /solo desde 2026-10-31/);
  const [b] = canalesDelMes({ businessId: "b", mes: "2026-11", cuentas: [{ ...cuentas[0], ultimo_sync: "2026-11-27T12:00:00Z" }], ordenes });
  assert.match(b.motivoCobertura, /anterior al cierre/);
  const [c] = canalesDelMes({ businessId: "b", mes: "2026-11", cuentas: [{ ...cuentas[0], historico_desde: null }], ordenes });
  assert.match(c.motivoCobertura, /no declara/);
});
