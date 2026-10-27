import test from 'node:test';import assert from 'node:assert/strict';
import {claveBorradorCorte,guardarBorradorCorte,leerBorradorCorte,borrarBorradoresUsuario} from '../../src/features/inteligencia/utils/borradorCorte.js';
const ahora=new Date('2026-10-15T01:00:00Z');const usuario={auth_user_id:'karla'};
function almacen(){const datos=new Map();return {getItem:k=>datos.get(k)||null,setItem:(k,v)=>datos.set(k,v),removeItem:k=>datos.delete(k),key:i=>[...datos.keys()][i],get length(){return datos.size;}};}
test('el borrador pertenece a cuenta, sucursal y fecha de México; no usa nombres como identidad',()=>{
 const k=claveBorradorCorte(usuario,'centro',ahora);assert.match(k,/2026-10-14$/);
 assert.notEqual(k,claveBorradorCorte({auth_user_id:'otra'},'centro',ahora));assert.notEqual(k,claveBorradorCorte(usuario,'anaya',ahora));assert.equal(claveBorradorCorte({nombre:'Karla'},'centro',ahora),null);
});
test('Caja 1 y Caja 2 conservan borradores independientes',()=>{
 assert.notEqual(claveBorradorCorte(usuario,'centro','CAJA_1'),claveBorradorCorte(usuario,'centro','CAJA_2'));
});
test('recupera importes, destino y movimientos sin guardar fotos, enlaces o campos inesperados',()=>{
 const s=almacen(),k=claveBorradorCorte(usuario,'centro',ahora);guardarBorradorCorte(s,k,{ventaSicar:'123.40',efectivoFinal:'0',turnoCaja:'VESPERTINO',destinoEfectivoRetirado:'RESGUARDO',responsableEfectivoRetirado:'Mónica',detalleEfectivoRetirado:'Caja fuerte',responsable:'otra',fotoCorteUrl:'privada',movimientosCaja:[{id:'1',tipo:'salida',monto:'30',concepto:'Proveedor',recibidoPor:'Ana'}]},'sesion1',false,ahora);
 const b=leerBorradorCorte(s,k,ahora);assert.equal(b.formulario.ventaSicar,'123.40');assert.equal(b.formulario.efectivoFinal,'0');assert.equal(b.formulario.turnoCaja,'VESPERTINO');assert.equal(b.formulario.destinoEfectivoRetirado,'RESGUARDO');assert.equal(b.formulario.responsableEfectivoRetirado,'Mónica');assert.equal(b.sesionCajaId,'sesion1');assert.equal(b.formulario.movimientosCaja[0].monto,'30');assert.equal(b.formulario.responsable,undefined);assert.equal(b.formulario.fotoCorteUrl,undefined);
});
test('el formulario inicial no crea borrador; un cero capturado sí se conserva',()=>{
 const s=almacen();guardarBorradorCorte(s,'k',{fondoInicial:'1000'},null,false,ahora);assert.equal(s.length,0);guardarBorradorCorte(s,'k',{ventaSicar:'0'},null,true,ahora);assert.ok(leerBorradorCorte(s,'k',ahora));
});
test('descarta contenido corrupto o vencido sin recuperar importes antiguos',()=>{
 const s=almacen();s.setItem('k','roto');assert.equal(leerBorradorCorte(s,'k',ahora),null);assert.equal(s.length,0);
 guardarBorradorCorte(s,'k',{ventaSicar:'123'},null,false,ahora);assert.equal(leerBorradorCorte(s,'k',new Date(ahora.getTime()+12*60*60*1000+1)),null);
});
test('salir borra los borradores de esa cuenta y conserva los ajenos',()=>{
 const s=almacen();const propio=claveBorradorCorte(usuario,'centro',ahora),ajeno=claveBorradorCorte({auth_user_id:'otra'},'centro',ahora);s.setItem(propio,'x');s.setItem(ajeno,'y');borrarBorradoresUsuario(s,usuario);assert.equal(s.getItem(propio),null);assert.equal(s.getItem(ajeno),'y');
});
