import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularFlujo13Semanas, importePlaneado } from '../../src/features/inteligencia/utils/flujoCaja13Semanas.js';
test('Un importe ausente corta el cálculo de semanas futuras sin inventar ceros', () => {
 const filas=calcularFlujo13Semanas({saldoInicial:100,semanas:[{cobros:20,pagos:10},{cobros:'',pagos:0},{cobros:20,pagos:5}]});
 assert.equal(filas.length,13);assert.equal(filas[0].saldo,110);assert.equal(filas[1].saldo,null);assert.equal(filas[2].saldo,null);
});
test('El déficit se arrastra y puede recuperarse con cobros posteriores', () => {
 const filas=calcularFlujo13Semanas({saldoInicial:100,semanas:[{cobros:0,pagos:200},{cobros:150,pagos:0}]});
 assert.equal(filas[0].saldo,-100);assert.equal(filas[0].deficit,true);assert.equal(filas[1].saldo,50);
});
test('Cero confirmado es válido, ausencia y valores negativos no', () => {
 assert.equal(importePlaneado(0),0);assert.equal(importePlaneado(''),null);assert.equal(importePlaneado(false),null);assert.equal(importePlaneado(-5),null);
 assert.equal(calcularFlujo13Semanas({semanas:[{cobros:10,pagos:0} ]})[0].saldo,null);
});
