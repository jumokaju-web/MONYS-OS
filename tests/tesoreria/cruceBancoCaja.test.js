import test from 'node:test';import assert from 'node:assert/strict';
import {cruzarBancoCaja} from '../../src/features/tesoreria/utils/cruceBancoCaja.js';
test('coincide solo importe dirección y fecha operación o liquidación; conserva ambigüedad',()=>{
 const b=[{id:'a',cargo:'200.00',abono:'0.00',fecha_operacion:'2026-09-12',fecha_liquidacion:'2026-09-14'}];
 const m={id:'1',monto:200,tipo:'salida',fecha:'2026-09-14'};
 assert.equal(cruzarBancoCaja(b,[m,{...m,id:'2'}])[0].candidatos.length,2);
 for(const change of [{tipo:'entrada'},{monto:201},{fecha:'2026-09-15'},{estado:'Cancelado'},{monto:null}])assert.equal(cruzarBancoCaja(b,[{...m,...change}]).length,0);
});
