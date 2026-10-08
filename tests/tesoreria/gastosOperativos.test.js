import test from 'node:test';
import assert from 'node:assert/strict';
import { generarAnalisisFinanciero } from '../../src/features/inteligencia/ia/directorFinancieroIA.js';
test('inventario, préstamos y retiros afectan flujo pero no vuelven a descontarse de utilidad', () => {
  const categorias = ['compras_inventario', 'anticipo_prestamo', 'retiro_propietaria', 'pago_capital'];
  const movimientos = categorias.map((categoria) => ({ tipo: 'salida', estado: 'Revisado', categoria, expense_behavior: 'variable', monto: 100, fecha: '2026-10-01' }));
  movimientos.push({ tipo: 'salida', estado: 'Revisado', expense_category: 'renta', expense_behavior: 'fijo', monto: 50, fecha: '2026-10-01' });
  const resultado = generarAnalisisFinanciero({ movimientos, ventasTotales: 1000, costoTotal: 600, utilidadTotal: 400, fechaInicial: '2026-10-01', fechaFinal: '2026-10-04', diasAnalizados: 4 });
  assert.equal(resultado.gastosVariables, 0);
  assert.equal(resultado.gastosFijos, 50);
  assert.equal(resultado.utilidadNetaEstimada, 350);
  assert.equal(resultado.salidasTesoreria, 450);
});
