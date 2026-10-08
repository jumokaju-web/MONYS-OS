import { tomarPropuestaConsejo } from '../services/seguimientoConsejoService';
import { fechaConsejoValida } from '../utils/seguimientoConsejo';
import InteligenciaVisible from './InteligenciaVisible';
import { useEffect, useState } from 'react';
import { useUser } from '../../../context/UserContext';
import { consolidarFinanzasSucursales, construirComparativoSucursales } from '../shared/resumenSucursalesFinanciero';
import { guardarDecisionEjecutiva, obtenerHistorialDecisiones } from '../services/decisionesService';
import './JuntaDirectiva.css';

const dinero = (v) => v == null ? 'Pendiente' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
const asientos = [['financiero','Finanzas','Caja, obligaciones y capacidad de inversión'],['comercial','Ventas','Venta rentable y resultados por tienda'],['inventario','Inventario','Existencias, rotación y compras'],['marketing','Marketing','Campañas, presupuesto y resultados'],['rh','Equipo','Responsables, tareas y evidencia']];
export default function JuntaDirectiva({ sucursales = [], movimientos = [], importacionId, onAbrirDirector, onAbrirImportador, analisisConectados = {} }) {
  const { usuario } = useUser();
  const [tab, setTab] = useState('inteligencia');
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [responsable, setResponsable] = useState('');
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [revision, setRevision] = useState(0);
  const resumen = consolidarFinanzasSucursales(sucursales);
  const filas = construirComparativoSucursales(sucursales);
  const anaya = filas.find(f => /anaya/i.test(f.nombre));
  useEffect(() => {
    let vigente = true;
    setHistorial([]); setError('');
    if (!importacionId) return undefined;
    obtenerHistorialDecisiones({ importacionId, limite: 30 }).then(datos => { if (vigente) setHistorial(datos); }).catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [importacionId, revision]);
  async function seguirAcuerdo(decision, acuerdo) {
    if (guardando) return;
    setGuardando(true); setMensaje('');
    try {
      const tarea = await tomarPropuestaConsejo({ usuario, fecha: acuerdo.fechaRevision, periodo: `Acuerdo ${decision.id}`, propuesta: { titulo: acuerdo.titulo, descripcion: `Acuerdo ${decision.id}. Responsable indicado en bitácora: ${acuerdo.responsable}. Revisión tomada por ${usuario.nombre}. ${acuerdo.nota || ''}`, fuente: `Bitácora de Junta · decisión ${decision.id} · importación ${importacionId}`, cruce: 'Comprobar caja y viabilidad, adjuntar evidencia, resultado y siguiente acción.' } });
      setMensaje(tarea.existente ? `Este acuerdo ya tiene la tarea ${tarea.id}, a cargo de ${tarea.responsable}.` : `Seguimiento ${tarea.id} creado a tu nombre, con fecha ${tarea.fecha}. El responsable original de la bitácora se conserva.`);
    } catch (e) { setMensaje(e.message); }
    finally { setGuardando(false); }
  }
  async function registrar() {
    if (guardando) return;
    if (!importacionId || !usuario || !responsable.trim() || !fecha) { setMensaje('Selecciona una importación y completa responsable y fecha de revisión.'); return; }
    setGuardando(true); setMensaje('');
    try {
      await guardarDecisionEjecutiva({ tipoDecision: 'JUNTA_REVISION_CAJA_Y_RESCATE', estado: 'REGISTRADA', autorizadoPor: usuario.nombre || usuario.name || 'Usuario autenticado', importacionId,
        descripcion: JSON.stringify({ titulo: 'Revisar caja y viabilidad de General Anaya', responsable: responsable.trim(), fechaRevision: fecha, nota: nota.trim(), periodo: resumen.disponible ? [resumen.fechaInicial, resumen.fechaFinal] : null, evidencia: resumen.disponible ? { ventas: resumen.ventas, utilidadBruta: resumen.utilidad } : null, alcance: 'Acuerdo de revisión; sin pago, compra ni tarea asignada automáticamente' }) });
      setMensaje('Acuerdo registrado en la bitácora. La revisión queda a cargo del responsable indicado.'); setRevision(v => v + 1);
    } catch(e) { setMensaje(e.message); }
    finally { setGuardando(false); }
  }
  return <section className="junta" aria-label="Junta Directiva IA">
    <header><div><span className="junta-label">DIRECCIÓN DEL NEGOCIO</span><h2>Junta Directiva <em>IA</em></h2><p>La siguiente decisión, con evidencia y seguimiento.</p></div><span className="junta-pill">{resumen.disponible ? `${resumen.fechaInicial} → ${resumen.fechaFinal}` : 'Base de información incompleta'}</span></header>
    <nav aria-label="Secciones de la junta">{[['inteligencia','Inteligencia'],['agenda','Agenda'],['directores','Directores'],['rescate','General Anaya'],['bitacora','Bitácora']].map(([id,label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === 'inteligencia' && <InteligenciaVisible {...analisisConectados} onAbrirDirector={onAbrirDirector} />}
    {tab === 'agenda' && <div className="junta-columns"><article className="junta-principal"><span className="junta-label">PROPUESTA PARA REVISIÓN</span><h3>Proteger caja antes de ampliar el gasto</h3><p>{resumen.disponible ? `SICAR reporta ${dinero(resumen.utilidad)} de utilidad bruta en el corte. Todavía falta conciliar caja, banco y gastos para conocer la capacidad disponible.` : resumen.motivo}</p><dl><dt>Finanzas pide</dt><dd>Saldo inicial, cobros y compromisos de las próximas 13 semanas.</dd><dt>Marketing necesita</dt><dd>Presupuesto autorizado, stock por tienda y resultados de cada campaña.</dd><dt>Inventario debe validar</dt><dd>Disponibilidad, margen y cobertura antes de proponer compras.</dd></dl><p className="junta-cautela">Propuesta basada en reglas y datos disponibles. No representa una votación ni conversaciones autónomas entre agentes.</p><button type="button" onClick={() => onAbrirDirector('financiero')}>Abrir Finanzas y flujo de caja →</button></article><article><h3>Acuerdo de la junta</h3><p>Registra quién revisará la caja y cuándo. Guardar el acuerdo no ejecuta gastos ni asigna una tarea al equipo.</p><label>Responsable de revisión<input value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Nombre de la persona" maxLength={120}/></label><label>Fecha de revisión<input type="date" value={fecha} onChange={e => setFecha(e.target.value)}/></label><label>Observación o cambio a la propuesta<textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={2000} rows={3}/></label><button type="button" disabled={guardando || !importacionId || !usuario} onClick={registrar}>{guardando ? 'Guardando…' : 'Registrar acuerdo de revisión'}</button>{!importacionId && <p>Abre un corte importado para vincular el acuerdo a su evidencia.</p>}{mensaje && <p role="status">{mensaje}</p>}</article></div>}
    {tab === 'directores' && <div className="junta-asientos">{asientos.map(([id,nombre,descripcion]) => <article key={id}><span className="junta-label">DIRECTOR</span><h3>{nombre}</h3><p>{descripcion}</p><button type="button" onClick={() => onAbrirDirector(id)}>Ver análisis y acciones →</button></article>)}<article><h3>Operación y Rescate</h3><p>La agenda de rescate está disponible aquí. El director operativo y su conexión de evidencia todavía requieren implementación.</p><button type="button" onClick={() => setTab('rescate')}>Abrir plan de rescate →</button></article></div>}
    {tab === 'rescate' && <div><h3>General Anaya · primero comprobar viabilidad</h3><p>{anaya ? `${anaya.nombre}: ventas ${dinero(anaya.ventas)} · utilidad bruta ${dinero(anaya.utilidadBruta)} · ${anaya.periodoEtiqueta || 'Periodo pendiente'}.` : 'Falta cargar el corte de General Anaya.'} La utilidad bruta aún no permite decidir rentabilidad, crecimiento o cierre.</p><div className="junta-asientos">{[['01','Verdad financiera','Conciliar caja, gastos, nómina, renta y deuda; separar préstamos y retiros.','financiero'],['02','Recuperar venta rentable','Elegir una oportunidad con stock real, margen y responsable; medir ventas y gasto por tienda.','marketing'],['03','Prueba de 2–4 semanas','Definir línea base, objetivo, fecha y evidencia. Revisar resultado económico antes de repetir.','comercial']].map(([n,t,d,id]) => <article key={n}><span className="junta-label">ETAPA {n} · POR REVISAR</span><h3>{t}</h3><p>{d}</p><button type="button" onClick={() => onAbrirDirector(id)}>Trabajar esta etapa →</button></article>)}</div></div>}
    {tab === 'bitacora' && <div><h3>Decisiones del corte actual</h3><p>Puedes tomar personalmente la revisión de un acuerdo. Se crea una tarea con evidencia requerida; esto no ejecuta pagos ni cambia al responsable original.</p>{mensaje && <p role="status">{mensaje}</p>}{error && <p role="alert">{error}</p>}{!importacionId ? <p>Selecciona una importación para consultar su historial.</p> : historial.length === 0 && !error ? <p>No hay acuerdos registrados para este corte.</p> : historial.map(d => { let texto = d.descripcion; let acuerdo = null; try { const registro = JSON.parse(texto); if (d.tipo_decision === 'JUNTA_REVISION_CAJA_Y_RESCATE' && registro.titulo && fechaConsejoValida(registro.fechaRevision)) acuerdo = registro; texto = `${registro.titulo} · Responsable: ${registro.responsable} · Revisar: ${registro.fechaRevision}${registro.nota ? ' · ' + registro.nota : ''}`; } catch { /* Historial anterior en texto. */ } return <article key={d.id}><strong>{d.estado}</strong><p>{texto}</p>{acuerdo && <button type="button" disabled={guardando || !usuario?.branch_id} onClick={() => seguirAcuerdo(d, acuerdo)}>{guardando ? 'Guardando…' : 'Tomar seguimiento a mi nombre'}</button>}<small>{d.creado_en ? new Date(d.creado_en).toLocaleString('es-MX') : 'Fecha no disponible'} · {d.estado_ejecucion || 'Ejecución no registrada'}</small></article>; })}<button type="button" onClick={() => setRevision(v => v + 1)}>Actualizar historial</button></div>}
    <footer>Fuentes: reportes SICAR por sucursal; {movimientos.length} movimientos cargados, sin inferir que están conciliados. <button type="button" onClick={onAbrirImportador}>Completar reportes</button></footer>
  </section>;
}
