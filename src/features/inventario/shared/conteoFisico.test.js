import assert from "node:assert/strict";
import test from "node:test";

import {
  crearCapturaConteoInicial,
  crearResultadoConteoInventario,
  leerResultadoConteoInventario,
  prepararDetalleConteoInventario,
  validarCapturaConteoInventario,
} from "./conteoFisico.js";

test("prepara un renglón auditable por producto sin inventar existencia", () => {
  const detalle = prepararDetalleConteoInventario([
    { codigo: "001", descripcion: "Base", existencia: -2, motivoRevision: "NEGATIVO" },
    { descripcion: "Corrector", existencia: null },
  ]);

  assert.equal(detalle[0].codigo, "001");
  assert.equal(detalle[0].existenciaSistema, -2);
  assert.equal(detalle[1].existenciaSistema, null);
  assert.notEqual(detalle[0].id, detalle[1].id);
});

test("exige piezas completas y explicación únicamente cuando hay diferencia", () => {
  const detalle = prepararDetalleConteoInventario([
    { codigo: "A", descripcion: "Producto A", existencia: 4 },
  ]);

  assert.equal(validarCapturaConteoInventario(detalle, { [detalle[0].id]: { existenciaFisica: "3" } }).valido, false);
  assert.equal(validarCapturaConteoInventario(detalle, { [detalle[0].id]: { existenciaFisica: "4" } }).valido, true);
  assert.equal(validarCapturaConteoInventario(detalle, { [detalle[0].id]: { existenciaFisica: "3", observacion: "Una pieza dañada" } }).valido, true);
});

test("guarda y recupera el conteo estructurado con su diferencia", () => {
  const detalle = prepararDetalleConteoInventario([
    { codigo: "B", descripcion: "Producto B", existencia: 2 },
  ]);
  const resultado = crearResultadoConteoInventario(detalle, {
    [detalle[0].id]: { existenciaFisica: "5", observacion: "Llegaron tres sin registrar" },
  });
  const leido = leerResultadoConteoInventario(resultado);
  const captura = crearCapturaConteoInicial(detalle, resultado);

  assert.equal(leido.productos[0].diferencia, 3);
  assert.equal(captura[detalle[0].id].existenciaFisica, 5);
  assert.equal(captura[detalle[0].id].observacion, "Llegaron tres sin registrar");
});

