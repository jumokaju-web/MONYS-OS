import test from 'node:test';
import assert from 'node:assert/strict';
import { resumirCortesHoy, importeCorte } from '../../src/features/dashboard/utils/cortesHoy.js';
const fecha = '2026-10-21';
const corte = (id, branch = 'centro', caja = 'CAJA_1', datos = {}) => ({ id, branch_id: branch, fecha, turno: 'cierre_caja',
  observaciones: '[MONYS_CAJA_V1]' + JSON.stringify({ cajaId: caja, ventaSicar: 100, diferenciaCaja: 0, diferenciaVenta: 0, ...datos }) });

test('sin cortes o con importe faltante no interpreta venta cero', () => {
  assert.equal(resumirCortesHoy([], fecha).ventaReportada, null);
  assert.equal(importeCorte(''), null);
  assert.equal(importeCorte(null), null);
  assert.equal(importeCorte(0), 0);
  const sinImporte = resumirCortesHoy([corte('a', 'centro', 'CAJA_1', { ventaSicar: null })], fecha);
  assert.equal(sinImporte.ventaReportada, null);
  assert.equal(sinImporte.incompletos, 1);
});
test('suma cajas y sucursales distintas sin repetir filas del mismo id', () => {
  const a = corte('a');
  const r = resumirCortesHoy([a,a,corte('b','centro','CAJA_2',{ventaSicar:50}),corte('c','anaya')], fecha);
  assert.equal(r.cortes.length, 3);
  assert.equal(r.ventaReportada, 250);
  assert.equal(r.cajasRepetidas, false);
});
test('varios cortes de una caja requieren revisar turnos antes de sumar', () => {
  const r = resumirCortesHoy([corte('a'),corte('b')], fecha);
  assert.equal(r.cajasRepetidas, true);
  assert.equal(r.ventaReportada, null);
});
test('suma mañana y noche de la misma caja sin tratarlos como duplicados', () => {
  const r = resumirCortesHoy([
    corte('a', 'centro', 'CAJA_1', { turnoCaja: 'MATUTINO', ventaSicar: 80 }),
    corte('b', 'centro', 'CAJA_1', { turnoCaja: 'VESPERTINO', ventaSicar: 120 }),
  ], fecha);
  assert.equal(r.cajasRepetidas, false);
  assert.equal(r.ventaReportada, 200);
});
test('dos envíos del mismo turno y caja permanecen bloqueados como duplicados', () => {
  const r = resumirCortesHoy([
    corte('a', 'centro', 'CAJA_1', { turnoCaja: 'MATUTINO' }),
    corte('b', 'centro', 'CAJA_1', { turnoCaja: 'MATUTINO' }),
  ], fecha);
  assert.equal(r.cajasRepetidas, true);
  assert.equal(r.ventaReportada, null);
});
test('excluye aperturas y otros días, y señala diferencias de venta o efectivo', () => {
  const r = resumirCortesHoy([corte('a','centro','CAJA_1',{diferenciaCaja:-10}),
    corte('b','centro','CAJA_2',{diferenciaVenta:20}),
    {...corte('c','anaya'),fecha:'2026-10-20'},
    {id:'apertura',fecha,turno:'apertura_caja',observaciones:'[MONYS_APERTURA_CAJA_V1]{"cajaId":"CAJA_1"}'}],fecha);
  assert.equal(r.cortes.length,2);
  assert.equal(r.conDiferencias,2);
});
test('un cierre antiguo sin importes sigue visible como incompleto', () => {
  const r=resumirCortesHoy([{id:'viejo',fecha,turno:'cierre_caja',observaciones:''}],fecha);
  assert.equal(r.cortes.length,1);
  assert.equal(r.incompletos,1);
  assert.equal(r.ventaReportada,null);
});
test('aplica la corrección de caja antes de detectar envíos repetidos', () => {
  const corregir={id:'correccion',fecha,observaciones:'[MONYS_CORRECCION_CIERRE_V1]'+JSON.stringify({cierreId:'b',cajaId:'CAJA_2',responsableCorregido:'Karla'})};
  const r=resumirCortesHoy([corte('a'),corte('b'),corregir],fecha);
  assert.equal(r.cajasRepetidas,false);
  assert.equal(r.ventaReportada,200);
  assert.equal(r.cortes[1].cierre.responsable,'Karla');
});
