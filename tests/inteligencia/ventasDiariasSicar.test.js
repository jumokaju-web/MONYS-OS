import test from 'node:test';
import assert from 'node:assert/strict';
import { fechaVentaSicar, construirVentasDiariasSicar } from '../../src/features/inteligencia/utils/ventasDiariasSicar.js';
const inicio='2026-10-12', fin='2026-10-18';
const paquete=(id,desde=inicio,hasta=fin,detalles=null,creado='2026-10-21T12:00:00Z')=>({
 importacion:{id,branch_id:'centro',created_at:creado},
 detalles:detalles||Array.from({length:7},(_,i)=>({datos_originales:{fecha:`2026-10-${12+i}`,ventaTotal:100+i*10,utilidad:40,periodoInicio:desde,periodoFin:hasta}}))
});
test('las horas de Excel después del mediodía no cambian el día del ticket',()=>{
 assert.equal(fechaVentaSicar(46307.9),'2026-10-12');
 assert.equal(fechaVentaSicar('46307.9'),'2026-10-12');
 assert.equal(fechaVentaSicar('12/10/2026 19:00'),'2026-10-12');
 assert.equal(fechaVentaSicar('2026-02-30'),null);
 assert.equal(fechaVentaSicar(''),null);
});
test('determina extremos solo con todas las fechas y conserva utilidad bruta',()=>{
 const [r]=construirVentasDiariasSicar([paquete('a')],{centro:'Centro'});
 assert.equal(r.completa,true);
 assert.equal(r.fuertes[0].fecha,'2026-10-18');
 assert.equal(r.debiles[0].fecha,'2026-10-12');
 assert.equal(r.filas[0].utilidadBruta,40);
 assert.equal(r.filas[0].variacion,null);
});
test('no convierte un día sin registros en cero ni lo declara el más débil',()=>{
 const p=paquete('a');p.detalles.pop();
 const [r]=construirVentasDiariasSicar([p]);
 assert.equal(r.filas[6].ventas,null); assert.equal(r.completa,false);assert.deepEqual(r.debiles,[]);
});
test('un importe o fecha inválidos bloquean el ranking de ese periodo',()=>{
 const p=paquete('a');p.detalles[2].datos_originales.ventaTotal='';
 const [r]=construirVentasDiariasSicar([p]);
 assert.equal(r.invalidas,1);assert.deepEqual(r.fuertes,[]);assert.ok(r.filas.every(f=>f.ventas===null));
});
test('elige una sola importación por periodo y la más reciente sin sumar duplicados',()=>{
 const viejo=paquete('viejo');viejo.detalles[0].datos_originales.ventaTotal=999;
 const reciente=paquete('nuevo',inicio,fin,null,'2026-10-22T12:00:00Z');
 const [r]=construirVentasDiariasSicar([viejo,reciente]);
 assert.equal(r.filas[0].ventas,100);
});
test('compara exactamente siete días antes y no contra el día inmediato anterior',()=>{
 const previo=paquete('anterior','2026-10-05','2026-10-11');
 previo.detalles.forEach((f,i)=>Object.assign(f.datos_originales,{fecha:`2026-10-${String(5+i).padStart(2,'0')}`,ventaTotal:50}));
 const [r]=construirVentasDiariasSicar([paquete('actual'),previo]);
 assert.equal(r.filas[0].anterior,50);assert.equal(r.filas[0].variacion,100);
});
test('base de comparación cero no genera un porcentaje infinito',()=>{
 const previo=paquete('anterior','2026-10-05','2026-10-11');
 previo.detalles.forEach((f,i)=>Object.assign(f.datos_originales,{fecha:`2026-10-${String(5+i).padStart(2,'0')}`,ventaTotal:0}));
 const [r]=construirVentasDiariasSicar([paquete('actual'),previo]);
 assert.equal(r.filas[0].anterior,0);assert.equal(r.filas[0].variacion,null);
});
test('utilidad faltante no se inventa; empates conservan todos los días empatados',()=>{
 const p=paquete('a');p.detalles.forEach(f=>{f.datos_originales.ventaTotal=100;delete f.datos_originales.utilidad;});
 const [r]=construirVentasDiariasSicar([p]);assert.equal(r.fuertes.length,7);assert.equal(r.debiles.length,7);assert.equal(r.filas[0].utilidadBruta,null);
});
