import test from 'node:test';
import assert from 'node:assert/strict';
import { construirResultadoConsejo, leerResultadoConsejo, resumirSeguimientoConsejo } from '../../src/features/inteligencia/utils/seguimientoConsejo.js';
test('resultado exige evidencia y siguiente paso, conserva texto anterior',()=>{
 for(const campo of ['resumen','evidencia','siguienteAccion']) assert.throws(()=>construirResultadoConsejo({...{resumen:'Revisado',evidencia:'Corte del día',siguienteAccion:'Conciliar'},[campo]:' '}));
 const resultado=construirResultadoConsejo({resumen:' Revisado ',evidencia:'Corte del día',siguienteAccion:'Conciliar'});
 assert.equal(leerResultadoConsejo(resultado).resumen,'Revisado');
 assert.equal(leerResultadoConsejo('Texto anterior').resumen,'Texto anterior');
 assert.equal(resumirSeguimientoConsejo([{id:'a',estado:'terminada',resultado,evaluacion_estado:'pendiente',requiere_revision:true}]).revisadas,0);
});
