import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS_CORTE, fechaOperativaMexico, validarImportesCorte } from '../../src/features/inteligencia/utils/corteTienda.js';
test('el cierre de la noche conserva la fecha de México aunque UTC ya sea mañana', () => {
 assert.equal(fechaOperativaMexico(new Date('2026-10-15T01:30:00Z')), '2026-10-14');
 assert.equal(fechaOperativaMexico(new Date('2026-10-15T06:00:00Z')), '2026-10-15');
});
test('el efectivo contado no se puede omitir ni sustituir por el fondo objetivo', () => {
 const datos=Object.fromEntries(CAMPOS_CORTE.map(c=>[c,'0']));
 assert.equal(validarImportesCorte(datos),'');
 for(const c of CAMPOS_CORTE) for(const valor of ['', ' ', null, -1, Infinity, 'invalido']) assert.ok(validarImportesCorte({...datos,[c]:valor}));
});
