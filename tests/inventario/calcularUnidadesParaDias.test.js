import test from "node:test";
import assert from "node:assert/strict";

import {
  calcularUnidadesParaDias,
} from "../../src/features/inventario/shared/calcularUnidadesParaDias.js";

test("calcula el objetivo multiplicando antes de dividir y evita piezas extra por precisión decimal", () => {
  assert.equal(
    calcularUnidadesParaDias({
      unidadesVendidas: 6,
      diasAnalizados: 7,
      diasObjetivo: 14,
    }),
    12
  );

  assert.equal(
    calcularUnidadesParaDias({
      unidadesVendidas: 29,
      diasAnalizados: 7,
      diasObjetivo: 14,
    }),
    58
  );
});

test("mantiene pendiente un objetivo con venta ausente, periodo inválido o valores negativos", () => {
  assert.equal(calcularUnidadesParaDias({ unidadesVendidas: null, diasAnalizados: 7, diasObjetivo: 14 }), null);
  assert.equal(calcularUnidadesParaDias({ unidadesVendidas: 6, diasAnalizados: 0, diasObjetivo: 14 }), null);
  assert.equal(calcularUnidadesParaDias({ unidadesVendidas: -1, diasAnalizados: 7, diasObjetivo: 14 }), null);
});
