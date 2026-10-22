import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularFlujo13Semanas, construirCalendarioTanda, diagnosticarFlujo13Semanas, importePlaneado } from '../../src/features/inteligencia/utils/flujoCaja13Semanas.js';
test('Un importe ausente corta el cálculo de semanas futuras sin inventar ceros', () => {
 const filas=calcularFlujo13Semanas({saldoInicial:100,semanas:[{cobros:20,pagos:10},{cobros:'',pagos:0},{cobros:20,pagos:5}]});
 assert.equal(filas.length,13);assert.equal(filas[0].saldo,110);assert.equal(filas[1].saldo,null);assert.equal(filas[2].saldo,null);
});
test('El desglose exige todos los rubros y no convierte ausencias en cero', () => {
 const incompleta=calcularFlujo13Semanas({saldoInicial:100,semanas:[{cobros:20,nomina:10}]});
 const completa=calcularFlujo13Semanas({saldoInicial:100,semanas:[{cobros:20,nomina:10,proveedores:0,rentaServicios:0,impuestos:0,creditos:0,tandaPago:0,otrosPagos:0}]});
 assert.equal(incompleta[0].saldo,null);assert.equal(completa[0].pagos,10);assert.equal(completa[0].saldo,110);
});
test('La tanda separa aportaciones y cobros del ingreso operativo', () => {
 const tanda=construirCalendarioTanda({inicioFlujo:'2026-10-19',inicioTanda:'2026-09-21',semanasTanda:26,aportacionSemanal:500,numerosPropios:6,montoPorCobro:13000,cobros:['2026-11-02','2026-11-09']});
 assert.equal(tanda.valido,true);assert.equal(tanda.pagoSemanal,3000);assert.equal(tanda.aportacionTotal,78000);assert.equal(tanda.cobroTotal,26000);
 assert.equal(tanda.semanas[0].tandaPago,3000);assert.equal(tanda.semanas[2].tandaCobro,13000);assert.equal(tanda.semanas[3].tandaCobro,13000);
});
test('La tanda bloquea datos incompletos o fechas inválidas', () => {
 assert.equal(construirCalendarioTanda({inicioFlujo:'2026-10-19'}).valido,false);
 assert.equal(construirCalendarioTanda({inicioFlujo:'2026-10-19',inicioTanda:'2026-09-21',semanasTanda:26,aportacionSemanal:500,numerosPropios:6,montoPorCobro:13000,cobros:['fecha-mal']}).valido,false);
});
test('El déficit se arrastra y puede recuperarse con cobros posteriores', () => {
 const filas=calcularFlujo13Semanas({saldoInicial:100,semanas:[{cobros:0,pagos:200},{cobros:150,pagos:0}]});
 assert.equal(filas[0].saldo,-100);assert.equal(filas[0].deficit,true);assert.equal(filas[1].saldo,50);
});
test('Cero confirmado es válido, ausencia y valores negativos no', () => {
 assert.equal(importePlaneado(0),0);assert.equal(importePlaneado(''),null);assert.equal(importePlaneado(false),null);assert.equal(importePlaneado(-5),null);
 assert.equal(calcularFlujo13Semanas({semanas:[{cobros:10,pagos:0} ]})[0].saldo,null);
});
test('El diagnóstico bloquea únicamente el dato faltante y prioriza el primer déficit', () => {
 assert.equal(diagnosticarFlujo13Semanas({}).titulo,'Define la semana inicial');
 assert.equal(diagnosticarFlujo13Semanas({inicio:'2026-10-19'}).titulo,'Falta la caja disponible real');
 const semanas=Array.from({length:13},()=>({cobros:0,nomina:0,proveedores:0,rentaServicios:0,impuestos:0,creditos:0,tandaPago:0,otrosPagos:0}));
 semanas[0].nomina=200;
 const diagnostico=diagnosticarFlujo13Semanas({inicio:'2026-10-19',saldoInicial:100,semanas});
 assert.equal(diagnostico.tipo,'ESTIMACIÓN');assert.equal(diagnostico.semana,1);assert.equal(diagnostico.saldo,-100);
});
