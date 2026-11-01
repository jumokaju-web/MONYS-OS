import assert from "node:assert/strict";
import test from "node:test";

import { analizarResultadoCampana } from "../../src/features/inteligencia/utils/analisisResultadosMarketing.js";

test("recomienda escalar solo con ventas reportadas tres veces mayores al gasto", () => {
  const resultado = analizarResultadoCampana({ ventas_atribuidas: 3000, gasto_real: 1000, alcance: 10000, mensajes: 30, pedidos: 8 });
  assert.equal(resultado.accion, "ESCALAR");
  assert.equal(resultado.roas, 3);
});

test("recomienda pausar cuando la venta reportada es menor que la inversión", () => {
  const resultado = analizarResultadoCampana({ ventas_atribuidas: 500, gasto_real: 1000, alcance: 10000, mensajes: 5, pedidos: 1 });
  assert.equal(resultado.accion, "PAUSAR");
});

test("una campaña orgánica con pedidos se puede repetir sin inventar rentabilidad", () => {
  const resultado = analizarResultadoCampana({ ventas_atribuidas: 0, gasto_real: 0, alcance: 800, mensajes: 12, pedidos: 2 });
  assert.equal(resultado.accion, "REPETIR");
  assert.equal(resultado.roas, undefined);
});

test("datos inválidos bloquean la recomendación numérica", () => {
  const resultado = analizarResultadoCampana({ ventas_atribuidas: null, gasto_real: 100, alcance: 1000, mensajes: 1, pedidos: 0 });
  assert.equal(resultado.accion, "REVISAR");
});
