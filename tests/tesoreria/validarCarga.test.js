import test from 'node:test';import assert from 'node:assert/strict';import {validarCarga} from '../../src/features/importador/utils/validarCarga.js';
const base={branchId:'centro',tipoReporte:'Utilidad de ventas',datosNormalizados:[{venta:100}]};
test('no permite importaciones sin sucursal, tipo o filas válidas',()=>{for(const cambio of [{branchId:''},{branchId:null},{tipoReporte:''},{datosNormalizados:[]},{datosNormalizados:[null]},{datosNormalizados:[[]]}])assert.throws(()=>validarCarga({...base,...cambio}));});
test('acepta reportes preparados con sucursal explícita',()=>assert.equal(validarCarga(base),true));
