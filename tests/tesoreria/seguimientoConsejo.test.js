import test from 'node:test';
import assert from 'node:assert/strict';
import { resumirSeguimientoConsejo, fechaConsejoHoy, fechaConsejoValida, tituloPropuestaConsejo } from '../../src/features/inteligencia/utils/seguimientoConsejo.js';
test('terminar no equivale a verificar, ni verificar demuestra ingreso', () => {
 const r=resumirSeguimientoConsejo([
  {id:'a',estado:'terminada',resultado:'',evaluacion_estado:'aprobada',requiere_revision:false},
  {id:'b',estado:'terminada',resultado:'revisé caja',evaluacion_estado:'aprobada',requiere_revision:false},
  {id:'c',estado:'terminada',resultado:'revisé caja',evaluacion_estado:'aprobada',requiere_revision:true},
 ],'2026-10-08');
 assert.equal(r.porVerificar,2);assert.equal(r.revisadas,1);assert.equal(r.filas.find(t=>t.id==='b').etiqueta,'Resultado revisado');assert.equal(r.valorEconomico,undefined);
});
test('prioriza vencidas, excluye canceladas y cierres, no duplica IDs', () => {
 const a={id:'a',estado:'pendiente',fecha:'2026-10-07',responsable:'Mónica'};
 const r=resumirSeguimientoConsejo([a,a,{id:'b',estado:'cancelada',fecha:'2026-10-01'},{id:'c',estado:'terminada',fecha:'2026-10-01'},{id:'d',estado:'pendiente',fecha:'2026-10-08'}],'2026-10-08');
 assert.equal(r.total,4);assert.equal(r.vencidas,1);assert.equal(r.filas[0].id,'a');assert.equal(r.filas.find(t=>t.id==='d').vencida,false);
});
test('rechaza fechas inexistentes y informa responsable o fecha pendientes', () => {
 assert.equal(fechaConsejoValida('2026-02-30'),false);assert.equal(fechaConsejoValida('2024-02-29'),true);
 const r=resumirSeguimientoConsejo([{id:'a',estado:'pendiente',fecha:'2026-02-30',responsable:' '}],'2026-10-08');assert.equal(r.incompletas,1);assert.equal(r.vencidas,0);
});
test('usa fecha de México y mantiene distinta identidad por corte', () => {
 assert.equal(fechaConsejoHoy(new Date('2026-10-09T01:00:00Z')),'2026-10-08');
 assert.notEqual(tituloPropuestaConsejo({titulo:'Caja'},'semana 1'),tituloPropuestaConsejo({titulo:'Caja'},'semana 2'));
});
