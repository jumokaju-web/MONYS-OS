import test from "node:test";
import assert from "node:assert/strict";

import {
  construirGuiaVenta,
  construirLigaVendedoras,
  recomendarProductoVendedora,
  resolverEmpleadoVendedora,
} from "../../src/features/inteligencia/shared/asistenteVendedora.js";

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

test("arma una liga equilibrada y calcula ticket promedio", () => {
  const liga = construirLigaVendedoras({
    empleadoId: "karla",
    comisiones: [
      { empleadoId: "karla", empleado: "Karla Yoselin", ventas: 5000, tickets: 10 },
      { empleadoId: "ana", empleado: "Ana López", ventas: 6000, tickets: 6 },
    ],
  });
  assert.equal(liga.comparable, true);
  assert.equal(liga.ranking.length, 2);
  assert.equal(liga.actual.ticketPromedio, 500);
  assert.equal(liga.destacada.posicion, 1);
  assert.match(liga.recomendacion, /compras atendidas|ticket/i);
});

test("no declara ganadora con una sola vendedora comparable", () => {
  const liga = construirLigaVendedoras({
    empleadoId: "karla",
    comisiones: [{ empleadoId: "karla", empleado: "Karla", ventas: 1200, tickets: 3 }],
  });
  assert.equal(liga.comparable, false);
  assert.equal(liga.destacada, null);
  assert.equal(liga.actual.posicion, 1);
});

test("exige actividad mínima para evitar rankings engañosos", () => {
  const liga = construirLigaVendedoras({
    empleadoId: "ana",
    comisiones: [
      { empleadoId: "ana", empleado: "Ana", ventas: 5000, tickets: 1 },
      { empleadoId: "karla", empleado: "Karla", ventas: 4500, tickets: 8 },
    ],
  });
  assert.equal(liga.ranking.length, 1);
  assert.equal(liga.actual, null);
  assert.match(liga.recomendacion, /3 tickets/);
});

test("resuelve ficha RH por ID de usuario aunque no coincida con auth.uid", () => {
  const karla = { id: "empleada-1", usuario_id: "usuario-monys-1", usuario_sicar: "KARLA" };
  assert.equal(
    resolverEmpleadoVendedora([karla], { id: "usuario-monys-1", auth_user_id: "auth-1" }),
    karla,
  );
});
