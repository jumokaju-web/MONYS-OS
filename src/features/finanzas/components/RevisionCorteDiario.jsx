import { useEffect, useRef, useState } from 'react';
import { guardarRevisionCorte, obtenerHistorialRevisionCorte } from '../services/revisionesCortesService';
import { etiquetasRevision, estadoRevisionCorte, validarRevisionCorte } from '../utils/revisionCortes';

export default function RevisionCorteDiario({ captura, revision, onGuardado, disponible }) {
  const [abierto, setAbierto] = useState(false);
  const [formulario, setFormulario] = useState({ estado: 'ACLARAR', nota: '', evidencia: '', comprobaciones: {} });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const enviando = useRef(false);
  const validacion = validarRevisionCorte(formulario);
  const estado = estadoRevisionCorte(captura, revision);
  useEffect(() => {
    if (!abierto || !disponible) return;
    let activo = true;
    setCargandoHistorial(true);
    obtenerHistorialRevisionCorte(captura.cierre.id).then(datos => { if (activo) setHistorial(datos); }).catch(e => { if (activo) setError(e.message); }).finally(() => { if (activo) setCargandoHistorial(false); });
    return () => { activo = false; };
  }, [abierto, disponible, captura.cierre.id, revision?.version]);
  const actualizar = (campo, valor) => { setFormulario(f => ({ ...f, [campo]: valor })); setMensaje(''); };
  async function guardar(evento) {
    evento.preventDefault();
    if (validacion || !disponible || enviando.current) return;
    enviando.current = true;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const guardado = await guardarRevisionCorte(captura, revision, formulario);
      onGuardado(guardado);
      setFormulario({ estado: 'ACLARAR', nota: '', evidencia: '', comprobaciones: {} });
      setMensaje('Revisión guardada en MONYS. El corte original no fue modificado.');
    } catch (e) { setError(e.message); }
    finally { enviando.current = false; setGuardando(false); }
  }
  return <section className="revision-corte" aria-label={`Revisión del corte de ${captura.cierre.responsable}`}>
    <div className="revision-corte-top"><div><small>REVISIÓN COMPARTIDA</small><strong>{disponible ? etiquetasRevision[estado] : 'Revisión compartida no disponible'}</strong>{revision && <span>Versión {revision.version} · {new Date(revision.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</span>}</div><button type="button" disabled={!disponible || guardando} aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>{abierto ? 'Ocultar revisión' : 'Revisar y aclarar'}</button></div>
    {revision && <p className="revision-ultima"><b>Última explicación:</b> {revision.nota}<br/><b>Referencia:</b> {revision.evidencia}</p>}
    {estado === 'DESACTUALIZADO' && <p role="alert">El contenido del corte cambió después de la revisión. Comprueba otra vez las fuentes; se conserva la revisión anterior en el historial.</p>}
    {abierto && disponible && <div className="revision-corte-contenido"><form onSubmit={guardar}>
      <fieldset disabled={guardando}><legend>Deja una revisión con evidencia</legend>
        <label>Resultado<select value={formulario.estado} onChange={e => actualizar('estado', e.target.value)}><option value="ACLARAR">Solicitar o registrar aclaración</option><option value="REVISADO">Marcar revisado por propietaria</option></select></label>
        <div className="revision-comprobaciones">{[['sicar','Comparé el corte de SICAR'],['cobros','Comprobé los cobros y el efectivo'],['movimientos','Comprobé las entradas y salidas']].map(([id, texto]) => <label key={id}><input type="checkbox" checked={Boolean(formulario.comprobaciones[id])} onChange={e => actualizar('comprobaciones', { ...formulario.comprobaciones, [id]: e.target.checked })}/>{texto}</label>)}</div>
        <label>Qué revisaste, quién debe aclarar y siguiente acción<textarea rows="3" maxLength={2000} value={formulario.nota} onChange={e => actualizar('nota', e.target.value)} placeholder="Explica la diferencia o el resultado y quién dará seguimiento." required minLength={10}/></label>
        <label>Comprobante o referencia<input value={formulario.evidencia} maxLength={500} minLength={3} required onChange={e => actualizar('evidencia', e.target.value)} placeholder="Ej. foto del corte adjunta, folio de depósito o comprobante"/></label>
        <p className="revision-limite">Revisado significa que comprobaste estas fuentes. No modifica importes, no descuenta a empleadas y no equivale a conciliación bancaria ni cierre contable.</p>
        {validacion && <p className="revision-ayuda">{validacion}</p>}<button type="submit" disabled={Boolean(validacion) || guardando}>{guardando ? 'Guardando…' : 'Guardar revisión en MONYS'}</button>
      </fieldset>
    </form><aside><h4>Historial conservado</h4>{cargandoHistorial && <p role="status">Consultando historial…</p>}{!cargandoHistorial && historial.length === 0 && <p>Aún no hay revisiones registradas.</p>}{historial.map(item => <article key={item.id}><b>{etiquetasRevision[item.estado]} · v{item.version}</b><small>{new Date(item.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} · Revisó: {item.revisado_nombre}</small><p>{item.nota}</p><small>Referencia: {item.evidencia}</small></article>)}{historial.length === 50 && <p>Se muestran las últimas 50 revisiones.</p>}</aside></div>}
    {error && <p role="alert">{error} Si hubo cambios simultáneos, conserva tu texto y pulsa Actualizar para consultar la revisión vigente.</p>}{mensaje && <p role="status">{mensaje}</p>}
  </section>;
}
