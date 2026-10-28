import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerirMovimientoBancario, agruparSugerenciasBancarias, agruparPendientesPorNombre, prepararLoteSugerido, clasificarLoteSugerido, prepararClasificacionSegura, clasificarSugerenciasSeguras } from '../../src/features/tesoreria/utils/sugerenciasBancarias.js';
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
test('lote propuesto permite clasificar varios movimientos con una sola nota y deja fuera los desconocidos', () => {
 const comision1 = {...movimiento, id:'1', categoria:'Comisión bancaria / IVA', cargo:'12.50'};
 const comision2 = {...movimiento, id:'2', categoria:'Comisión bancaria / IVA', cargo:'8.25'};
 const desconocido = {...movimiento, id:'3', categoria:'Por aclarar', cargo:'500'};
 const paquete = { movimientos:[comision1, comision2, desconocido], otraPropiedad:'se conserva' };
 const lote = prepararLoteSugerido(paquete.movimientos, 'Comisión bancaria / IVA');
 assert.equal(lote.movimientos.length, 2); assert.equal(lote.importe, 20.75);
 const nuevo = clasificarLoteSugerido(paquete, 'Comisión bancaria / IVA', 'Comisión bancaria identificada en ambos cargos.', '2026-10-27T12:00:00.000Z');
 assert.equal(nuevo.otraPropiedad, 'se conserva');
 assert.equal(nuevo.movimientos[0].revision.clasificacion, 'Comisión bancaria / IVA');
 assert.equal(nuevo.movimientos[1].revision.nota, 'Comisión bancaria identificada en ambos cargos.');
 assert.equal(nuevo.movimientos[2].revision, undefined);
 assert.throws(() => clasificarLoteSugerido(paquete, 'Comisión bancaria / IVA', '  '), /criterio contable/);
});
test('lote excluye sugerencias con evidencia ambigua y nunca agrupa los desconocidos', () => {
 const evidencia={fecha:'2026-09-01',importe:275000,texto:'Pago sueldo Luis'};
 const filas=[{...movimiento,id:'ambigua',evidencia_whatsapp:[evidencia,evidencia]}, {...movimiento,id:'clara',evidencia_whatsapp:[evidencia]}];
 const lote=prepararLoteSugerido(filas,'Nómina');
 assert.equal(lote.movimientos.length,1); assert.equal(lote.ambiguos,1);
 assert.equal(prepararLoteSugerido(filas,'Sin destino identificado').movimientos.length,0);
});
test('propone en bloque los adelantos explícitos a choferes y no los confirma automáticamente', () => {
 const adelanto={...movimiento,id:'adelanto',descripcion:'SPEI adelanto chofer, descuento de pago',categoria:'Por aclarar'};
 const sugerencia=sugerirMovimientoBancario(adelanto);
 assert.equal(sugerencia.categoria,'Préstamo por recuperar');
 assert.equal(adelanto.revision,undefined);
 assert.equal(prepararLoteSugerido([adelanto],'Préstamo por recuperar').movimientos.length,1);
 const generico={...movimiento,descripcion:'SPEI ENVIADO STP',categoria:'Por aclarar'};
 assert.equal(sugerirMovimientoBancario(generico).categoria,'');
});
test('contador MONYS clasifica todos los grupos seguros y deja las excepciones pendientes', () => {
 const comision={...movimiento,id:'comision',cargo:'15.00',categoria:'Comisión bancaria / IVA'};
 const adelanto={...movimiento,id:'adelanto',cargo:'800.00',descripcion:'Adelanto chofer por descontar',categoria:'Por aclarar'};
 const desconocido={...movimiento,id:'desconocido',cargo:'22500.00',descripcion:'SPEI ENVIADO STP',categoria:'Por aclarar'};
 const confirmado={...movimiento,id:'confirmado',cargo:'100.00',revision:{estado:'Confirmado',clasificacion:'Personal'}};
 const paquete={movimientos:[comision,adelanto,desconocido,confirmado],cuentas:[{final:'1'}]};
 const plan=prepararClasificacionSegura(paquete.movimientos);
 assert.equal(plan.movimientos,2);
 assert.equal(plan.importe,815);
 assert.equal(plan.excepciones,1);
 assert.deepEqual(plan.grupos.map(grupo=>grupo.categoria).sort(),['Comisión bancaria / IVA','Préstamo por recuperar']);
 const nuevo=clasificarSugerenciasSeguras(paquete,'2026-10-27T23:00:00.000Z');
 assert.equal(nuevo.movimientos[0].revision.origen,'clasificacion_segura_monys');
 assert.equal(nuevo.movimientos[1].revision.clasificacion,'Préstamo por recuperar');
 assert.equal(nuevo.movimientos[2].revision,undefined);
 assert.deepEqual(nuevo.movimientos[3],confirmado);
 assert.deepEqual(nuevo.cuentas,paquete.cuentas);
});
test('agrupa por nombre repetido en concepto sin clasificar ni modificar los movimientos', () => {
 const oscar1={...movimiento,id:'oscar-1',descripcion:'SPEI ENVIADO OSCAR',cargo:'400.00'};
 const oscar2={...movimiento,id:'oscar-2',descripcion:'PAGO PARA OSCAR',cargo:'900.00'};
 const otro={...movimiento,id:'otro',descripcion:'SPEI ENVIADO STP',cargo:'22500.00'};
 const confirm={...movimiento,id:'confirm',descripcion:'SPEI ENVIADO OSCAR',revision:{estado:'Confirmado'}};
 const filas=[oscar1,oscar2,otro,confirm]; const antes=JSON.stringify(filas);
 const grupos=agruparPendientesPorNombre(filas);
 assert.equal(grupos.length,1); assert.equal(grupos[0].nombre,'OSCAR');
 assert.equal(grupos[0].cantidad,2); assert.equal(grupos[0].cargos,1300);
 assert.deepEqual(grupos[0].movimientos.map(m=>m.id),['oscar-1','oscar-2']);
 assert.equal(JSON.stringify(filas),antes);
});
