import test from 'node:test';
import assert from 'node:assert/strict';
import { pendientesResultadosMarketing } from '../../src/features/inteligencia/utils/pendientesResultadosMarketing.js';
test('un cero confirmado cierra un campo; un cero sin confirmar queda pendiente', () => {
  const [pendiente] = pendientesResultadosMarketing([{ estado: 'ACTIVA', resultado: { ventaAcumulada: 0, pedidosAcumulados: 0, gastoAcumulado: 0, camposConfirmados: { venta: true, gasto: true } } }]);
  assert.deepEqual(pendiente.faltantes, ['Pedidos']);
});
test('no propone medir campañas cerradas ni valida campos ausentes con una bandera', () => {
  assert.equal(pendientesResultadosMarketing([{ estado: 'FINALIZADA' }, { estado: 'DESCARTADA' }]).length, 0);
  const [p] = pendientesResultadosMarketing([{ estado: 'ACTIVA', resultado: { camposConfirmados: { venta: true } } }]);
  assert.equal(p.faltantes.length, 3);
});
