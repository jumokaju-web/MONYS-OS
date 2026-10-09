import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticoBancario } from '../../src/features/tesoreria/utils/diagnosticoBancario.js';
const p=()=>({version:1,cuentas:[{terminacion:'0035',desde:'2026-09-01',hasta:'2026-09-30',inicial:'100.00',cargos:'60.00',abonos:'20.00',final:'60.00',movimientos:3}],movimientos:[['a','50.00','0.00','PAGO TARJETA DE CREDITO'],['b','10.00','0.00','Pago'],['c','0.00','20.00','Abono']].map(([id,cargo,abono,descripcion])=>({id,cuenta:'0035',fecha_operacion:'2026-09-01',fecha_liquidacion:'2026-09-01',cargo,abono,descripcion,referencia_visible:'Concepto',categoria:'Personal'}))});
test('no transforma pistas en clasificaciones y prioriza incertidumbre por monto',()=>{
 const d=diagnosticoBancario(p());assert.equal(d.confirmados,0);assert.equal(d.importePendiente,80);assert.deepEqual(d.grupos,[]);assert.deepEqual(d.mayoresPendientes.map(m=>m.id),['a','c','b']);assert.equal(d.pagosPorDesglosar,50);
});
test('clasificación reduce pendiente sin convertir pago tarjeta en gasto calculado',()=>{
 const paquete=p();paquete.movimientos[0].revision={estado:'Confirmado',clasificacion:'Pago de tarjeta',nota:'Estado revisado'};
 const d=diagnosticoBancario(paquete);assert.equal(d.importePendiente,30);assert.equal(d.coberturaImporte,63);assert.equal(d.grupos[0].cargos,50);assert.equal(d.pagosPorDesglosar,50);
 const vacio=diagnosticoBancario(paquete,'6116');assert.equal(vacio.total,0);assert.deepEqual(vacio.grupos,[]);
});
