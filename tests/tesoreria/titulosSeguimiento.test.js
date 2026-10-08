import test from 'node:test';
import assert from 'node:assert/strict';
import { titulosSeguimientoCampana, tituloSeguimientoCanonico } from '../../src/features/inteligencia/utils/titulosSeguimientoCampana.js';
test('reconoce seguimiento anterior para no duplicarlo y cancelar ambas versiones al pausar', () => {
  const [nuevo, anterior] = titulosSeguimientoCampana(' Flawless Stay ');
  assert.equal(tituloSeguimientoCanonico(anterior), nuevo);
  assert.equal(tituloSeguimientoCanonico(nuevo), nuevo);
  assert.notEqual(tituloSeguimientoCanonico(anterior), tituloSeguimientoCanonico('Dar seguimiento a campaña sin avances: Colorton'));
  assert.deepEqual(titulosSeguimientoCampana(''), []);
});
