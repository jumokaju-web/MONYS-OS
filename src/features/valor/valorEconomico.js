const numero = (v) => v === null || v === undefined || typeof v === 'boolean' || (typeof v === 'string' && !v.trim()) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
export function validarIniciativa(d) {
 if (!String(d.titulo || '').trim() || !String(d.hipotesis || '').trim()) throw new Error('Escribe el título y qué cambio esperas comprobar.');
 if (!['utilidad_bruta','gasto'].includes(d.indicador)) throw new Error('Selecciona un indicador económico.');
 if (numero(d.base) === null || numero(d.base) < 0 || numero(d.dias) === null || !Number.isInteger(Number(d.dias)) || Number(d.dias) < 1) throw new Error('Completa la línea base y sus días de medición.');
 if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') || Number.isNaN(Date.parse(d.fecha+'T12:00:00Z')) || new Date(d.fecha+'T12:00:00Z').toISOString().slice(0,10)!==d.fecha || !String(d.fuenteBase || '').trim()) throw new Error('Indica fecha de revisión y fuente de la línea base.');
 return {...d,titulo:d.titulo.trim(),hipotesis:d.hipotesis.trim(),base:Number(d.base),dias:Number(d.dias)};
}
export function validarResultado(d, base) {
 if (numero(d.observado) === null || numero(d.observado) < 0 || numero(d.costo) === null || numero(d.costo) < 0) throw new Error('Completa resultado y costo de la acción; confirma 0 si no hubo costo.');
 if (Number(d.dias) !== Number(base.dias)) throw new Error('Compara periodos de la misma duración.');
 if (!String(d.evidencia || '').trim() || !String(d.aprendizaje || '').trim()) throw new Error('Añade una referencia de evidencia y el aprendizaje de la prueba.');
 return {...d,observado:Number(d.observado),costo:Number(d.costo),dias:Number(d.dias),evidencia:d.evidencia.trim(),aprendizaje:d.aprendizaje.trim()};
}
export function leerRegistroValor(tarea) {
 try {const r=typeof tarea.resultado === 'string' ? JSON.parse(tarea.resultado) : tarea.resultado;return r?.tipo === 'INICIATIVA_VALOR_V1' ? r : null;} catch {return null;}
}
export function calcularCambioObservado(registro) {
 if (!registro?.resultado || !['gasto','utilidad_bruta'].includes(registro.indicador)) return null;
 const base=numero(registro.base),despues=numero(registro.resultado.observado),costo=numero(registro.resultado.costo);
 if (base===null || despues===null || costo===null || Number(registro.dias)!==Number(registro.resultado.dias))return null;
 const cambio=registro.indicador==='gasto' ? base-despues : despues-base;
 return Math.round((cambio-costo)*100)/100;
}
export function resumirIngresosPrograma(movimientos = []) {
 const registros=[];
 for(const m of movimientos) {
  const texto=String(m.concept || '');const tipo=/^\[MONYS (LICENCIA|IMPLEMENTACION|COSTO)\]/i.exec(texto)?.[1]?.toUpperCase();
  if (!tipo || String(m.status || '').toLowerCase()==='cancelado')continue;
  const importe=numero(m.amount);if(importe===null || importe<=0)continue;
  const entrada=String(m.movement_type).toUpperCase()==='ENTRADA';
  if ((tipo==='COSTO' && entrada) || (tipo!=='COSTO' && !entrada))continue;
  registros.push({...m,tipoPrograma:tipo,revisado:String(m.status || '').trim().toLowerCase()==='revisado'});
 }
 const revisados=registros.filter(r=>r.revisado);
 return {registros,cobrosDocumentados:revisados.filter(r=>r.tipoPrograma!=='COSTO').reduce((s,r)=>s+Number(r.amount),0),costosDocumentados:revisados.filter(r=>r.tipoPrograma==='COSTO').reduce((s,r)=>s+Number(r.amount),0),pendientes:registros.filter(r=>!r.revisado).length,hayCobros:revisados.some(r=>r.tipoPrograma!=='COSTO'),hayCostos:revisados.some(r=>r.tipoPrograma==='COSTO')};
}
export function calcularEscenarioSoftware({clientes,precio,costoFijo,costoCliente}) {
 const c=numero(clientes),p=numero(precio),f=numero(costoFijo),v=numero(costoCliente);
 if([c,p,f,v].some(n=>n===null || n<0) || !Number.isInteger(c))return null;
 const contribucion=p-v;return {ingresosMensuales:c*p,costosMensuales:f+c*v,resultadoMensual:c*(p-v)-f,clientesEquilibrio:contribucion>0?Math.ceil(f/contribucion):null};
}
