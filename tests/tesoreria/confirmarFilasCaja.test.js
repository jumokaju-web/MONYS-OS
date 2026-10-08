import test from 'node:test';import assert from 'node:assert/strict';import {confirmarFilasCaja} from '../../src/features/importador/utils/confirmarFilasCaja.js';
test('caja exige confirmar todas las filas del reporte',()=>{assert.equal(confirmarFilasCaja(10,10),true);for(const n of [0,9,11,null,undefined])assert.throws(()=>confirmarFilasCaja(n,10),/pendiente de revisión/);});
