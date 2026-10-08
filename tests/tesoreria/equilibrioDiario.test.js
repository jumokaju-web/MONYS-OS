import test from 'node:test';import assert from 'node:assert/strict';
import {calcularEquilibrioDiario} from '../../src/features/inteligencia/utils/equilibrioDiario.js';
const base={gastosFijos:30000,margenBruto:40,variablePorcentaje:5,diasAbiertos:25,deuda:10000,ventaPrevista:100000};
test('separa operación y deuda con margen de contribución',()=>{const r=calcularEquilibrioDiario(base);assert.equal(r.calculable,true);assert.equal(r.contribucion,0.35);assert.equal(r.operacionDiaria,30000/0.35/25);assert.equal(r.cajaDiaria,40000/0.35/25);assert.equal(r.excedenteOperacion,5000);assert.equal(r.excedenteDespuesDeuda,-5000);});
test('ausencias no son cero y cero confirmado sí calcula',()=>{assert.equal(calcularEquilibrioDiario({...base,deuda:''}).calculable,false);assert.equal(calcularEquilibrioDiario({...base,deuda:0}).calculable,true);});
test('bloquea margen no rentable, días imposibles y negativos',()=>{for(const cambio of [{margenBruto:5},{diasAbiertos:0},{diasAbiertos:2.5},{diasAbiertos:32},{deuda:-1},{margenBruto:101}])assert.equal(calcularEquilibrioDiario({...base,...cambio}).calculable,false);});
