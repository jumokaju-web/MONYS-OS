import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerirMovimientoBancario, agruparSugerenciasBancarias } from '../../src/features/tesoreria/utils/sugerenciasBancarias.js';
const movimiento = { cargo: '2750.00', abono: '0.00', fecha_operacion: '2026-09-01', fecha_liquidacion: '2026-09-02', categoria: 'Por aclarar' };
test('un mensaje salarial con misma fecha e importe propone nómina sin aprobar', () => {
 const m = { ...movimiento, evidencia_whatsapp: [{ fecha: '2026-09-01', importe: 275000, texto: 'Pago sueldo Luis' }] };
 assert.equal(sugerirMovimientoBancario(m).categoria, 'Nómina'); assert.equal(m.revision, undefined);
});
test('mensajes con otro importe o fecha no se usan como evidencia coincidente', () => {
 const m = { ...movimiento, evidencia_whatsapp: [{fecha:'2026-09-01',importe:1,texto:'sueldo'}, {fecha:'2026-09-03',importe:275000,texto:'sueldo'}] };
 assert.equal(sugerirMovimientoBancario(m).coincidencias.length, 0); assert.equal(sugerirMovimientoBancario(m).categoria, '');
});
test('varias coincidencias permanecen ambiguas sin sugerencia salarial automática', () => {
 const e = {fecha:'2026-09-01',importe:275000,texto:'sueldo'};
 const s = sugerirMovimientoBancario({...movimiento,evidencia_whatsapp:[e,e]}); assert.equal(s.ambigua,true); assert.equal(s.categoria,'');
});
test('grupos excluyen confirmados y suman en centavos sin cambiar los movimientos', () => {
 const filas = [{...movimiento,cargo:'0.10',categoria:'Comisión bancaria / IVA'}, {...movimiento,cargo:'0.20',categoria:'Comisión bancaria / IVA'}, {...movimiento,revision:{estado:'Confirmado'}}];
 const antes = JSON.stringify(filas); const grupos = agruparSugerenciasBancarias(filas);
 assert.equal(grupos.length,1); assert.equal(grupos[0].cargos,0.30); assert.equal(grupos[0].cantidad,2); assert.equal(JSON.stringify(filas),antes);
});
test('cobros de terminal se proponen como conciliación y créditos como pagos', () => {
 assert.equal(sugerirMovimientoBancario({...movimiento,categoria:'Abono de terminal: conciliar SICAR'}).categoria,'Cobro de tienda: conciliar SICAR');
 assert.equal(sugerirMovimientoBancario({...movimiento,categoria:'Pago de crédito: falta desglose'}).categoria,'Pago de crédito');
});
