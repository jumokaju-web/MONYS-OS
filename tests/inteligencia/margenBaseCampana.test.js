import assert from "node:assert/strict";
import test from "node:test";
import { obtenerMargenRealBaseCampana } from "../../src/features/inteligencia/shared/margenBaseCampana.js";

test("usa el margen SICAR directo de una campaña de un producto", () => {
  assert.equal(
    obtenerMargenRealBaseCampana({ margenReal: 32.5 }),
    32.5,
  );
});

test("pondera los márgenes multiproducto por ventas históricas reales", () => {
  const margen = obtenerMargenRealBaseCampana({
    tipo: "METRICAS_SEPARADAS_POR_PRODUCTO",
    productos: [
      { importeBase: 1000, utilidadBase: 250 },
      { importeBase: 3000, utilidadBase: 900 },
    ],
  });

  assert.equal(margen, 28.75);
});

test("conserva un margen real igual a cero", () => {
  assert.equal(
    obtenerMargenRealBaseCampana({
      productos: [{ importeBase: 400, utilidadBase: 0 }],
    }),
    0,
  );
});

test("no calcula margen cuando faltan ventas o utilidad base", () => {
  assert.equal(
    obtenerMargenRealBaseCampana({
      productos: [{ importeBase: 400, utilidadBase: null }],
    }),
    null,
  );
  assert.equal(
    obtenerMargenRealBaseCampana({
      productos: [{ importeBase: 0, utilidadBase: 0 }],
    }),
    null,
  );
});
