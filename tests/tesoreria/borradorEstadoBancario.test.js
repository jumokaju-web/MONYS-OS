import test from 'node:test';
import assert from 'node:assert/strict';
import { claveRevisionBancaria, guardarRevisionBancaria, recuperarRevisionBancaria } from '../../src/features/tesoreria/utils/borradorEstadoBancario.js';
const paquete={version:1,cuentas:[{terminacion:'0035',desde:'2026-09-01',hasta:'2026-09-30',inicial:'10.00',cargos:'2.50',abonos:'0.00',final:'7.50',movimientos:1}],movimientos:[{id:'a',cuenta:'0035',fecha_operacion:'2026-09-01',fecha_liquidacion:'2026-09-01',descripcion:'Pago',referencia_visible:'Concepto',cargo:'2.50',abono:'0.00'}]};
test('separa usuarios, negocios y sucursales y recupera solo la clave exacta',()=>{
 const u={auth_user_id:'u',organization_id:'o',business_id:'b',branch_id:'s'};
 const clave=claveRevisionBancaria(u);const mapa=new Map();const storage={setItem:(k,v)=>mapa.set(k,v),getItem:k=>mapa.get(k)};
 guardarRevisionBancaria(storage,clave,paquete);assert.deepEqual(recuperarRevisionBancaria(storage,clave).paquete,paquete);
 for(const campo of ['auth_user_id','organization_id','business_id','branch_id'])assert.equal(recuperarRevisionBancaria(storage,claveRevisionBancaria({...u,[campo]:'otro'})),null);
 assert.equal(claveRevisionBancaria({}),null);
});
test('no acepta borrador alterado y propaga error de almacenamiento',()=>{
 assert.throws(()=>guardarRevisionBancaria({setItem(){throw Error('cuota');}},'clave',paquete),/cuota/);
 const alterado=structuredClone(paquete);alterado.cuentas[0].final='8.00';
 assert.throws(()=>recuperarRevisionBancaria({getItem:()=>JSON.stringify({version:1,guardado:'hoy',paquete:alterado})},'clave'),/no cuadra/);
});
