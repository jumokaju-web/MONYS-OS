import test from "node:test";
import assert from "node:assert/strict";
import { consultarTodasLasPaginas } from "../../src/features/tesoreria/utils/paginarConsultaSupabase.js";

test("consulta y concatena todas las páginas, incluso cuando superan el límite", async () => {
  const filas = [1, 2, 3, 4, 5];
  const rangos = [];
  const resultado = await consultarTodasLasPaginas(async (inicio, fin) => {
    rangos.push([inicio, fin]);
    return { data: filas.slice(inicio, fin + 1), error: null };
  }, { pageSize: 2 });

  assert.deepEqual(resultado, filas);
  assert.deepEqual(rangos, [[0, 1], [2, 3], [4, 5]]);
});

test("consulta una página vacía final cuando el total es múltiplo exacto", async () => {
  const rangos = [];
  const resultado = await consultarTodasLasPaginas(async (inicio, fin) => {
    rangos.push([inicio, fin]);
    return { data: inicio < 4 ? [inicio, inicio + 1] : [], error: null };
  }, { pageSize: 2 });

  assert.deepEqual(resultado, [0, 1, 2, 3]);
  assert.equal(rangos.length, 3);
});

test("propaga errores de cualquier página sin devolver un resultado parcial", async () => {
  await assert.rejects(
    consultarTodasLasPaginas(async (inicio) => inicio === 0
      ? { data: [1, 2], error: null }
      : { data: null, error: new Error("falló segunda página") }, { pageSize: 2 }),
    /falló segunda página/,
  );
});
