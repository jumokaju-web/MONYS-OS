import test from "node:test";
import assert from "node:assert/strict";

import { construirGuiaVenta, recomendarProductoVendedora } from "../../src/features/inteligencia/shared/asistenteVendedora.js";

test("recomienda el producto líder y cruza su existencia", () => {
  const producto = recomendarProductoVendedora({
    metricas: { productoMasVendido: { codigo: "A-1", descripcion: "Labial Mate", cantidad: 12 } },
    inventario: { detalles: [{ datos_originales: { codigo: "A-1", descripcion: "Labial Mate", existencia: 7 } }] },
  });
  assert.deepEqual(producto, {
    codigo: "A-1", nombre: "Labial Mate", piezasVendidas: 12, existencia: 7, inventarioVerificado: true,
  });
});

test("no promete existencia cuando solo hay ventas", () => {
  const producto = recomendarProductoVendedora({
    metricas: { productoMasVendido: { descripcion: "Base tono 03", cantidad: 4 } },
  });
  const guia = construirGuiaVenta({ producto });
  assert.equal(producto.inventarioVerificado, false);
  assert.match(guia.detalle, /no pudo confirmar existencia/i);
});

test("una tarea asignada tiene prioridad sobre la sugerencia comercial", () => {
  const guia = construirGuiaVenta({
    producto: { nombre: "Labial", existencia: 8, inventarioVerificado: true },
    tareaPrioritaria: { titulo: "Llamar a clienta", estado: "pendiente" },
  });
  assert.equal(guia.titulo, "Llamar a clienta");
  assert.equal(guia.origen, "TAREA ASIGNADA");
});
