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
test('prioriza presupuesto excedido y gasto sin ventas; conserva cero confirmado', () => {
  const lista = pendientesResultadosMarketing([
    { id: 'pendiente', estado: 'ACTIVA', resultado: {} },
    { id: 'sinventa', estado: 'ACTIVA', presupuesto: 300, resultado: { gastoAcumulado: 200 } },
    { id: 'excedida', estado: 'ACTIVA', presupuesto: 100, resultado: { gastoAcumulado: 150, ventaAcumulada: 300, pedidosAcumulados: 2 } },
    { id: 'cero', estado: 'ACTIVA', presupuesto: 300, resultado: { gastoAcumulado: 250, ventaAcumulada: 0, pedidosAcumulados: 0, camposConfirmados: { venta: true, pedidos: true } } },
  ]);
  assert.deepEqual(lista.map((p) => p.campana.id), ['excedida', 'sinventa', 'cero', 'pendiente']);
  assert.equal(lista[2].venta, 0);
});
test('la antigüedad usa resultados reales y no cambios administrativos de campaña', () => {
  const ahora = Date.parse('2026-10-08T04:00:00Z');
  const resultado = { ventaAcumulada: 500, gastoAcumulado: 100, pedidosAcumulados: 2 };
  assert.deepEqual(pendientesResultadosMarketing([{ estado: 'ACTIVA', updated_at: '2026-10-01', resultado }], ahora), []);
  const [p] = pendientesResultadosMarketing([{ estado: 'ACTIVA', updated_at: '2026-10-08', resultado: { ...resultado, historial: [{ registradoEn: '2026-10-05T04:00:00Z' }] } }], ahora);
  assert.equal(p.horasSinResultados, 72);
});
