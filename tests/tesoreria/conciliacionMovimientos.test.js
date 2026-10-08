import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararRevisionFinanciera } from '../../src/features/tesoreria/utils/conciliacionMovimientos.js';

test('sugiere revisar gasolina sin convertirla en gasto ni modificar su préstamo', () => {
  const movimiento = { categoria: 'anticipo_prestamo', concepto: 'Gasolina Javier', monto: 300, estado: 'Revisado' };
  const antes = structuredClone(movimiento);
  const [item] = prepararRevisionFinanciera([movimiento]);
  assert.equal(item.motivo, 'Préstamo o anticipo');
  assert.deepEqual(movimiento, antes);
});
test('excluye cancelados y reconoce campos originales de banco', () => {
  const items = prepararRevisionFinanciera([
    { status: 'Cancelado', concept: 'Préstamo Oscar' },
    { status: 'Revisado', concept: 'Pago crédito auto', amount: 6218.8 },
    { estado: 'Revisado', concepto: 'Compra proveedor', categoria: 'compras_inventario' },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].motivo, 'Posible pago de crédito');
});
test('no pierde pendientes genéricos ni interpreta un nombre como préstamo', () => {
  const items = prepararRevisionFinanciera([{ concepto: 'Piña', estado: 'Pendiente de revisión' }]);
  assert.equal(items[0].motivo, 'Clasificación pendiente');
  assert.deepEqual(prepararRevisionFinanciera(), []);
});
