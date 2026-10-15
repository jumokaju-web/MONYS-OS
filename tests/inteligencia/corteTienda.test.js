import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS_CORTE, fechaOperativaMexico, validarCierreCajaParaEnvio, validarImportesCorte } from '../../src/features/inteligencia/utils/corteTienda.js';
test('el cierre de la noche conserva la fecha de México aunque UTC ya sea mañana', () => {
 assert.equal(fechaOperativaMexico(new Date('2026-10-15T01:30:00Z')), '2026-10-14');
 assert.equal(fechaOperativaMexico(new Date('2026-10-15T06:00:00Z')), '2026-10-15');
});
test('el efectivo contado no se puede omitir ni sustituir por el fondo objetivo', () => {
 const datos=Object.fromEntries(CAMPOS_CORTE.map(c=>[c,'0']));
 assert.equal(validarImportesCorte(datos),'');
 for(const c of CAMPOS_CORTE) for(const valor of ['', ' ', null, -1, Infinity, 'invalido']) assert.ok(validarImportesCorte({...datos,[c]:valor}));
});

test('el cierre no se puede enviar sin identidad, caja, apertura, foto e importes', () => {
 const formulario=Object.fromEntries(CAMPOS_CORTE.map(c=>[c,'0']));
 const base={responsable:'Karla Yoselin',branchId:'centro',cajaId:'CAJA_1',tieneSesionCaja:true,fotoCorte:{name:'corte.jpg'},formulario};
 assert.equal(validarCierreCajaParaEnvio(base),'');
 assert.match(validarCierreCajaParaEnvio({...base,responsable:''}),/iniciar sesión/);
 assert.match(validarCierreCajaParaEnvio({...base,branchId:null}),/sucursal/);
 assert.match(validarCierreCajaParaEnvio({...base,cajaId:''}),/Caja 1 o Caja 2/);
 assert.match(validarCierreCajaParaEnvio({...base,tieneSesionCaja:false}),/Abre la caja/);
 assert.equal(validarCierreCajaParaEnvio({...base,tieneSesionCaja:false,corteSinApertura:true}),'');
 assert.match(validarCierreCajaParaEnvio({...base,fotoCorte:null}),/foto del corte/);
 assert.match(validarCierreCajaParaEnvio({...base,formulario:{...formulario,ventaSicar:''}}),/Completa los importes/);
});
