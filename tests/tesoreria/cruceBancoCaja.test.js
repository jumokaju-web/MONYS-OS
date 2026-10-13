import test from 'node:test';import assert from 'node:assert/strict';
import {cruzarBancoCaja,resumirCruceBancoCaja} from '../../src/features/tesoreria/utils/cruceBancoCaja.js';
test('coincide solo importe dirección y fecha operación o liquidación; conserva ambigüedad',()=>{
 const b=[{id:'a',cargo:'200.00',abono:'0.00',fecha_operacion:'2026-09-12',fecha_liquidacion:'2026-09-14'}];
 const m={id:'1',monto:200,tipo:'salida',fecha:'2026-09-14'};
 assert.equal(cruzarBancoCaja(b,[m,{...m,id:'2'}])[0].candidatos.length,2);
 for(const change of [{tipo:'entrada'},{monto:201},{fecha:'2026-09-15'},{estado:'Cancelado'},{monto:null}])assert.equal(cruzarBancoCaja(b,[{...m,...change}]).length,0);
});
test('un vínculo activo confirma el cruce y evita reutilizar el mismo movimiento de caja',()=>{
 const banco=[
  {id:'a',cargo:'200.00',abono:'0.00',fecha_operacion:'2026-09-12',fecha_liquidacion:'2026-09-14'},
  {id:'b',cargo:'200.00',abono:'0.00',fecha_operacion:'2026-09-12',fecha_liquidacion:'2026-09-14'},
 ];
 const caja=[{id:'caja-1',monto:200,tipo:'salida',fecha:'2026-09-14'}];
 const conciliaciones=[{id:'link-1',estado:'ACTIVA',banco_movimiento_id:'a',cash_movement_id:'caja-1'}];
 const cruces=cruzarBancoCaja(banco,caja,conciliaciones);
 assert.equal(cruces.length,1);
 assert.equal(cruces[0].banco.id,'a');
 assert.equal(cruces[0].conciliacion.id,'link-1');
});
test('resume conciliados, únicos, ambiguos y movimientos sin coincidencia',()=>{
 const banco=[
  {id:'a',cargo:'200.00',abono:'0.00',fecha_operacion:'2026-09-14',fecha_liquidacion:'2026-09-14'},
  {id:'b',cargo:'300.00',abono:'0.00',fecha_operacion:'2026-09-14',fecha_liquidacion:'2026-09-14'},
  {id:'c',cargo:'400.00',abono:'0.00',fecha_operacion:'2026-09-14',fecha_liquidacion:'2026-09-14'},
  {id:'d',cargo:'500.00',abono:'0.00',fecha_operacion:'2026-09-14',fecha_liquidacion:'2026-09-14'},
 ];
 const caja=[
  {id:'1',monto:200,tipo:'salida',fecha:'2026-09-14'},
  {id:'2',monto:300,tipo:'salida',fecha:'2026-09-14'},
  {id:'3',monto:400,tipo:'salida',fecha:'2026-09-14'},
  {id:'4',monto:400,tipo:'salida',fecha:'2026-09-14'},
 ];
 const conciliaciones=[{id:'link',estado:'ACTIVA',banco_movimiento_id:'a',cash_movement_id:'1'}];
 assert.deepEqual(resumirCruceBancoCaja(banco,caja,conciliaciones),{totalBanco:4,conciliados:1,candidatos:1,ambiguos:1,sinCoincidencia:1});
});
