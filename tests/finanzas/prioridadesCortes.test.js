import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarCorte, seleccionarCortes, resumirAlertasCortes } from '../../src/features/finanzas/utils/prioridadesCortes.js';
const corte = (id, caja, venta = 0, foto = 'https://example.test/corte.jpg') => ({ tipo: 'caja', cierre: { id, fecha: '2026-10-14', responsable: 'Karla' }, datos: { diferenciaCaja: caja, diferenciaVenta: venta, fotoCorteUrl: foto } });
test('faltantes y sobrantes opuestos no ocultan dos cortes pendientes', () => {
  assert.deepEqual(resumirAlertasCortes([corte('1', -200), corte('2', 200)]), { faltantes: 200, sobrantes: 200, conDiferencia: 2, sinEvidencia: 0, incompletos: 0 });
});
test('diferencia en ventas requiere aclaración aunque cuadre caja', () => {
  assert.equal(diagnosticarCorte(corte('1', 0, 20)).nivel, 'diferencia');
});
test('ausencia de datos nunca se interpreta como cero confirmado', () => {
  for (const valor of [null, undefined, '', ' ', 'error']) assert.equal(diagnosticarCorte(corte('1', valor)).nivel, 'incompleto');
});
test('prioriza datos incompletos y diferencias; foto y cifras no equivalen a aprobación', () => {
  const capturas = [corte('1', 0), corte('2', 0, 0, ''), corte('3', -10), corte('4', null)];
  assert.deepEqual(seleccionarCortes(capturas).map(c => c.cierre.id), ['4', '3', '2', '1']);
  assert.equal(diagnosticarCorte(capturas[0]).nivel, 'revision');
});
test('filtros inclusivos combinan fecha, responsable, origen y prioridad', () => {
  const lista = [corte('1', -10), { ...corte('2', -20), cierre: { id: '2', fecha: '2026-10-13', responsable: 'Ana' } }];
  assert.deepEqual(seleccionarCortes(lista, { desde: '2026-10-14', hasta: '2026-10-14', buscar: 'KARLA', tipo: 'caja', nivel: 'diferencia' }).map(c => c.cierre.id), ['1']);
  assert.equal(seleccionarCortes(lista, { desde: '2026-10-15', hasta: '2026-10-13' }).length, 0);
});
test('no mezcla liquidaciones con diferencias de caja y contabiliza evidencia faltante aun con diferencia', () => {
  assert.deepEqual(resumirAlertasCortes([corte('1', -0.01, 0, ''), { tipo: 'flotilla', datos: { diferenciaCaja: -999 } }]), { faltantes: 0.01, sobrantes: 0, conDiferencia: 1, sinEvidencia: 1, incompletos: 0 });
});
test('una revisión vigente baja la prioridad sin borrar la diferencia histórica', () => {
 const lista = [corte('1', -200), corte('2', -20)];
 lista[0].cierre.observaciones = 'original';
 const revisiones = { '1': { estado: 'REVISADO', snapshot_observaciones: 'original' } };
 assert.deepEqual(seleccionarCortes(lista, {}, revisiones).map(c => c.cierre.id), ['2', '1']);
 assert.equal(resumirAlertasCortes(lista, revisiones).conDiferencia, 1);
 assert.equal(resumirAlertasCortes(lista, revisiones).faltantes, 220);
 lista[0].cierre.observaciones = 'modificado';
 assert.equal(resumirAlertasCortes(lista, revisiones).conDiferencia, 2);
});
