import test from "node:test";
import assert from "node:assert/strict";
import {
  validarMovimientoParaRevision,
  CATEGORIAS_GASTO,
} from "./validacionMovimientoTesoreria.js";

test("no marca como revisada una salida sin categoría o clasificación fija/variable", () => {
  assert.equal(validarMovimientoParaRevision({ movement_type: "SALIDA" }).valido, false);
  assert.equal(validarMovimientoParaRevision({
    movement_type: "SALIDA",
    expense_category: "nomina",
  }).valido, false);
  assert.equal(validarMovimientoParaRevision({
    movement_type: "SALIDA",
    expense_category: "sin_clasificar",
    expense_behavior: "variable",
  }).valido, false);
});

test("permite revisar una salida clasificada y permite no aplica para anticipos", () => {
  assert.equal(validarMovimientoParaRevision({
    movement_type: "SALIDA",
    expense_category: "renta",
    expense_behavior: "fijo",
  }).valido, true);
  assert.equal(validarMovimientoParaRevision({
    tipo: "salida",
    categoria: "anticipo_prestamo",
    comportamiento: "no_aplica",
  }).valido, true);
  assert.equal(validarMovimientoParaRevision({
    movement_type: "SALIDA",
    expense_category: "retiro_propietaria",
    expense_behavior: "no_aplica",
  }).valido, true);
});

test("impide sacar un gasto operativo del cálculo con no aplica", () => {
  const resultado = validarMovimientoParaRevision({
    movement_type: "SALIDA",
    expense_category: "renta",
    expense_behavior: "no_aplica",
  });
  assert.equal(resultado.valido, false);
  assert.match(resultado.motivo, /debe ser fijo o variable/);
});

test("una entrada no requiere categoría de gasto y el catálogo mantiene las categorías de alta", () => {
  assert.equal(validarMovimientoParaRevision({ movement_type: "ENTRADA" }).valido, true);
  assert.ok(CATEGORIAS_GASTO.some(([valor]) => valor === "compras_inventario"));
  assert.ok(CATEGORIAS_GASTO.some(([valor]) => valor === "anticipo_prestamo"));
});
