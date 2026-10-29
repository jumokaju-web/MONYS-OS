import { useState } from 'react';
import { leerResultadoConsejo } from '../utils/seguimientoConsejo';
import { guardarResultadoConsejo } from '../services/seguimientoConsejoService';
export default function ResultadoConsejo({ tarea, usuario, onGuardado }) {
 const previo=leerResultadoConsejo(tarea.resultado);
 const [resumen,setResumen]=useState(previo?.resumen || '');
 const [evidencia,setEvidencia]=useState(previo?.evidencia || '');
 const [siguienteAccion,setSiguiente]=useState(previo?.siguienteAccion || '');
 const [ocupado,setOcupado]=useState(false); const [error,setError]=useState('');
 async function guardar(e) {e.preventDefault();if(ocupado)return;setOcupado(true);setError('');try {await guardarResultadoConsejo({usuario,tareaId:tarea.id,resumen,evidencia,siguienteAccion});onGuardado?.();}catch(err){setError(err.message);}finally{setOcupado(false);}}
 return <div>{previo && <div><p>Resultado reportado: {previo.resumen || 'Consultar registro en Operación'}</p>{previo.evidencia && <p>Evidencia indicada: {previo.evidencia}</p>}{previo.siguienteAccion && <p>Siguiente acción: {previo.siguienteAccion}</p>}</div>}
 {tarea.estado !== 'cancelada' && <details><summary>Registrar resultado y siguiente acción</summary><form onSubmit={guardar}><p>Describe la evidencia; adjunta los archivos en Operación. Guardar solicita una nueva revisión y no termina ni aprueba la tarea.</p>
 <label>Resultado observado<textarea required maxLength={4000} value={resumen} onChange={e=>setResumen(e.target.value)}/></label>
 <label>Evidencia o referencia comprobable<textarea required maxLength={4000} value={evidencia} onChange={e=>setEvidencia(e.target.value)}/></label>
 <label>Siguiente acción o motivo para no continuar<textarea required maxLength={4000} value={siguienteAccion} onChange={e=>setSiguiente(e.target.value)}/></label>
 <button type="submit" disabled={ocupado}>{ocupado?'Guardando…':'Guardar para revisión'}</button>{error && <p role="alert">{error}</p>}</form></details>}</div>;
}
