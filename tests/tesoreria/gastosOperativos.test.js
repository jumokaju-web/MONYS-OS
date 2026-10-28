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

test('un pago mixto conserva una sola salida de caja y reparte gasto por destino', () => {
  const movimientos = [{
    tipo: 'salida',
    estado: 'Revisado',
    monto: 30000,
    expense_category: 'otro',
    expense_behavior: 'variable',
    fecha: '2026-10-01',
    distribucionActiva: true,
    distribuciones: [
      { business_id: 'monys', branch_id: 'centro', amount: 18000, expense_category: 'renta', expense_behavior: 'fijo' },
      { business_id: 'flotilla', branch_id: 'no-aplica', amount: 12000, expense_category: 'transporte', expense_behavior: 'variable' },
    ],
  }];
  const resultado = generarAnalisisFinanciero({
    movimientos,
    ventasTotales: 1000,
    costoTotal: 600,
    utilidadTotal: 400,
    fechaInicial: '2026-10-01',
    fechaFinal: '2026-10-04',
    diasAnalizados: 4,
  });
  assert.equal(resultado.salidasTesoreria, 30000);
  assert.equal(resultado.gastosFijos, 18000);
  assert.equal(resultado.gastosVariables, 12000);
  assert.equal(resultado.utilidadNetaEstimada, -29600);
});

test('un pago distribuido a otra empresa no se vuelve a contar como salida de su caja', () => {
  const resultado = generarAnalisisFinanciero({
    movimientos: [{
      tipo: 'salida',
      estado: 'Revisado',
      monto: 30000,
      fecha: '2026-10-01',
      excluirDeFlujoTesoreria: true,
      distribucionActiva: true,
      distribuciones: [
        { business_id: 'flotilla', branch_id: 'no-aplica', amount: 12000, expense_category: 'transporte', expense_behavior: 'variable' },
      ],
    }],
    ventasTotales: 1000,
    costoTotal: 600,
    utilidadTotal: 400,
    fechaInicial: '2026-10-01',
    fechaFinal: '2026-10-04',
    diasAnalizados: 4,
  });
  assert.equal(resultado.salidasTesoreria, 0);
  assert.equal(resultado.gastosVariables, 12000);
  assert.equal(resultado.utilidadNetaEstimada, -11600);
});

test('pagos a proveedor y anticipos pendientes siguen en flujo, pero no inflan el gasto sin clasificar', () => {
  const movimientos = [
    { tipo: 'salida', estado: 'Pendiente de revisión', categoria: 'anticipo_prestamo', monto: 99711.75, fecha: '2026-10-19' },
    { tipo: 'salida', estado: 'Pendiente de revisión', categoria: 'sin_clasificar', monto: 4260, fecha: '2026-10-19' },
  ];
  const resultado = generarAnalisisFinanciero({
    movimientos,
    ventasTotales: 147105.92,
    costoTotal: 87953.84,
    utilidadTotal: 59152.08,
    fechaInicial: '2026-10-19',
    fechaFinal: '2026-10-25',
    diasAnalizados: 7,
  });

  assert.equal(resultado.salidasTesoreria, 103971.75);
  assert.equal(resultado.gastosSinClasificar, 4260);
  assert.equal(resultado.movimientosPendientes, 2);
  assert.equal(resultado.utilidadNetaEstimada, 59152.08);
});
