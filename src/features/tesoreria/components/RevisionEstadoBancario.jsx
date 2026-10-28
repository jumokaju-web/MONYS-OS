import { useEffect, useMemo, useState } from 'react';
import { validarEstadoBancario } from '../utils/validarEstadoBancario';
import './RevisionEstadoBancario.css';
import { guardarRevisionBanco, recuperarRevisionBanco } from '../services/revisionBancariaService';
import { sugerirMovimientoBancario, coincideBeneficiarioBancario, agruparSugerenciasBancarias, agruparPendientesPorNombre, clasificarGrupoBeneficiario, actualizarReglasBancarias, aplicarReglasBancarias, prepararLoteSugerido, clasificarLoteSugerido, prepararClasificacionSegura, clasificarSugerenciasSeguras } from '../utils/sugerenciasBancarias';
import { prepararComisiones, clasificarComisiones, prepararTerminales, clasificarTerminales } from '../utils/clasificacionComisiones';
import CruceBancoCaja from './CruceBancoCaja';
import DiagnosticoEstadoBancario from './DiagnosticoEstadoBancario';
import { useUser } from '../../../context/UserContext';
import { claveRevisionBancaria, guardarRevisionBancaria, recuperarRevisionBancaria } from '../utils/borradorEstadoBancario';
import { obtenerFacturasIngresoFlotillaPeriodo } from '../../dashboard/services/facturasIngresoFlotillaService.js';
import { proponerCrucesFacturasEstadoCuenta } from '../utils/cruceFacturasEstadoCuenta.js';
const categorias = ['Cobro de flotilla', 'Cobro de tienda: conciliar SICAR', 'Transferencia interna', 'Combustible', 'Proveedor', 'Nómina', 'Gasto operativo', 'Pago de crédito', 'Pago de tarjeta', 'Préstamo por recuperar', 'Personal', 'Comisión bancaria / IVA', 'Crédito recibido', 'Recuperación de préstamo', 'Aportación de capital', 'Otro'];
const dinero = n => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const notaComunDeLote = categoria => categoria === 'Préstamo por recuperar'
  ? 'Adelantos o préstamos recuperables; vincular la recuperación con el pago futuro del beneficiario.'
  : `Clasificación por lote confirmada por la titular: ${categoria}.`;
export default function RevisionEstadoBancario({ movimientos = [], creditosProveedores = {} }) {
  const { usuario } = useUser();
  const clave = claveRevisionBancaria(usuario);
  return <RevisionBancariaSesion key={clave || 'sin-alcance'} clave={clave} usuario={usuario} movimientos={movimientos} creditosProveedores={creditosProveedores} />;
}
function RevisionBancariaSesion({ clave, usuario, movimientos, creditosProveedores }) {
  const [paquete, setPaquete] = useState(null);
  const [reglasBancarias, setReglasBancarias] = useState([]);
  const [reglasSugeridas, setReglasSugeridas] = useState(0);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [direccion, setDireccion] = useState('');
  const [grupo, setGrupo] = useState('');
  const [personaGrupo, setPersonaGrupo] = useState('');
  const [movimientoObjetivo, setMovimientoObjetivo] = useState('');
  const [grupoPersonaLote, setGrupoPersonaLote] = useState('');
  const [categoriaPersonaLote, setCategoriaPersonaLote] = useState('');
  const [notaPersonaLote, setNotaPersonaLote] = useState('');
  const [confirmarPersonaLote, setConfirmarPersonaLote] = useState(false);
  const [revisarComisiones, setRevisarComisiones] = useState(false);
  const [revisarTerminales, setRevisarTerminales] = useState(false);
  const [revisionId, setRevisionId] = useState(null);
  const [facturasFlotilla, setFacturasFlotilla] = useState([]);
  const [cargandoFacturasCruce, setCargandoFacturasCruce] = useState(false);
  useEffect(() => {
    if (!clave || usuario?.role !== 'owner') return undefined;
    let vigente = true;
    setSincronizando(true);
    recuperarRevisionBanco({
      role: usuario?.role, auth_user_id: usuario?.auth_user_id,
      organization_id: usuario?.organization_id, business_id: usuario?.business_id,
      branch_id: usuario?.branch_id,
    }).then(registro => {
      if (!vigente || !registro) return;
      const paqueteConReglas = actualizarReglasBancarias(registro.paquete);
      const reglas = paqueteConReglas.reglas_bancarias || [];
      const aplicado = aplicarReglasBancarias(paqueteConReglas, reglas);
      setReglasBancarias(reglas); setPaquete(aplicado.paquete); setReglasSugeridas(aplicado.sugeridas);
      setRevisionId(registro.id);
      setGuardado('Tus movimientos guardados se cargaron de MONYS.');
    }).catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setSincronizando(false); });
    return () => { vigente = false; };
  }, [clave, usuario?.role, usuario?.auth_user_id, usuario?.organization_id, usuario?.business_id, usuario?.branch_id]);
  const [cuenta, setCuenta] = useState('');
  const [pendientes, setPendientes] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [editando, setEditando] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [nota, setNota] = useState('');
  const [grupoLote, setGrupoLote] = useState('');
  const [notaLote, setNotaLote] = useState('');
  const [confirmarLote, setConfirmarLote] = useState(false);
  useEffect(() => {
    if (!grupoLote) return;
    requestAnimationFrame(() => document.getElementById('banco-lote-activo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [grupoLote]);
  const [revisarClasificacionSegura, setRevisarClasificacionSegura] = useState(false);
  const resumen = useMemo(() => paquete ? validarEstadoBancario(paquete) : null, [paquete]);
  const periodoEstado = useMemo(() => {
    const cuentas = paquete?.cuentas || [];
    return cuentas.length ? {
      desde: cuentas.map((item) => item.desde).sort()[0],
      hasta: cuentas.map((item) => item.hasta).sort().at(-1),
    } : null;
  }, [paquete?.cuentas]);
  useEffect(() => {
    const organizationId = usuario?.organization_id;
    if (!organizationId || !periodoEstado) { setFacturasFlotilla([]); return undefined; }
    let vigente = true;
    setCargandoFacturasCruce(true);
    obtenerFacturasIngresoFlotillaPeriodo({ organizationId, ...periodoEstado })
      .then((resultado) => { if (vigente) setFacturasFlotilla(resultado.facturas); })
      .catch((e) => { if (vigente) setError(e.message || 'No se pudieron consultar facturas de Flotilla.'); })
      .finally(() => { if (vigente) setCargandoFacturasCruce(false); });
    return () => { vigente = false; };
  }, [usuario?.organization_id, periodoEstado]);
  const crucesFacturas = useMemo(() => proponerCrucesFacturasEstadoCuenta(facturasFlotilla, paquete), [facturasFlotilla, paquete]);
  const filtrados = useMemo(() => (paquete?.movimientos || []).filter(m => (!cuenta || m.cuenta === cuenta) && (!grupo || (sugerirMovimientoBancario(m).categoria || 'Sin destino identificado') === grupo) && coincideBeneficiarioBancario(m, personaGrupo) && (!direccion || (direccion === 'entrada' ? Number(m.abono) > 0 : Number(m.cargo) > 0)) && (!pendientes || m.revision?.estado !== 'Confirmado') && [m.descripcion, m.referencia_visible, m.categoria, m.revision?.clasificacion, m.revision?.nota].join(' ').toLowerCase().includes(filtro.toLowerCase())), [paquete, cuenta, pendientes, filtro, direccion, grupo, personaGrupo]);
  useEffect(() => {
    if (!grupo && !personaGrupo) return;
    requestAnimationFrame(() => document.getElementById('banco-resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [grupo, personaGrupo, pagina]);
  useEffect(() => {
    if (!movimientoObjetivo) return;
    requestAnimationFrame(() => { document.getElementById(`banco-mov-${movimientoObjetivo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMovimientoObjetivo(''); });
  }, [movimientoObjetivo, pagina, filtro, cuenta, grupo, personaGrupo]);
  const planComisiones = useMemo(() => paquete ? prepararComisiones(paquete, cuenta) : null, [paquete, cuenta]);
  const planTerminales = useMemo(() => paquete ? prepararTerminales(paquete, cuenta) : null, [paquete, cuenta]);
  const planSeguro = useMemo(() => paquete ? prepararClasificacionSegura(paquete.movimientos.filter(m => !cuenta || m.cuenta === cuenta)) : null, [paquete, cuenta]);
  const gruposPersona = useMemo(() => paquete ? agruparPendientesPorNombre(paquete.movimientos.filter(m => !cuenta || m.cuenta === cuenta)) : [], [paquete, cuenta]);
  const aceptarPaqueteGuardado = (registro, respaldo) => {
    const guardado = registro.paquete || respaldo;
    const reglas = guardado.reglas_bancarias || [];
    setReglasBancarias(reglas); setPaquete(guardado); setReglasSugeridas(guardado.movimientos.filter(m => m.revision?.origen === 'regla_historica_monys' && m.revision.estado !== 'Confirmado').length);
  };
  const guardarComisiones = async () => {
    if (!planComisiones?.movimientos.length) return;
    setSincronizando(true); setError('');
    try {
      const cantidad = planComisiones.movimientos.length;
      const nuevo = clasificarComisiones(paquete, cuenta);
      const registro = await guardarRevisionBanco(usuario, nuevo);
      aceptarPaqueteGuardado(registro, nuevo); setRevisionId(registro.id); setRevisarComisiones(false); setPagina(0); setEditando(null);
      setGuardado(`${cantidad} comisiones clasificadas y guardadas en MONYS. Versión ${registro.id}.`);
    } catch (e) { setError(e.message || 'No se pudo guardar. La revisión anterior sigue abierta.'); }
    finally { setSincronizando(false); }
  };
  const guardarTerminales = async () => {
    if (!planTerminales?.movimientos.length) return;
    setSincronizando(true); setError('');
    try {
      const cantidad = planTerminales.movimientos.length;
      const nuevo = clasificarTerminales(paquete, cuenta);
      const registro = await guardarRevisionBanco(usuario, nuevo);
      aceptarPaqueteGuardado(registro, nuevo); setRevisionId(registro.id); setRevisarTerminales(false); setPagina(0); setEditando(null);
      setGuardado(`${cantidad} cobros de terminal identificados y guardados en MONYS. Conciliación SICAR pendiente. Versión ${registro.id}.`);
    } catch (e) { setError(e.message || 'No se pudo guardar. La revisión anterior sigue abierta.'); }
    finally { setSincronizando(false); }
  };
  const guardarLoteSugerido = async () => {
    if (!confirmarLote) { setError('Confirma que la misma clasificación aplica a todo el bloque.'); return; }
    const movimientosGrupo = (paquete?.movimientos || []).filter(m => !cuenta || m.cuenta === cuenta);
    const lote = prepararLoteSugerido(movimientosGrupo, grupoLote);
    if (!lote.movimientos.length) { setError('No quedan movimientos claros pendientes en este bloque.'); return; }
    setSincronizando(true); setError('');
    try {
      const paqueteFiltrado = { ...paquete, movimientos: movimientosGrupo };
      const clasificados = clasificarLoteSugerido(paqueteFiltrado, grupoLote, notaLote);
      const idsClasificados = new Set(lote.movimientos.map(m => m.id));
      const nuevo = { ...paquete, movimientos: paquete.movimientos.map(m => idsClasificados.has(m.id) ? clasificados.movimientos.find(x => x.id === m.id) : m) };
      const registro = await guardarRevisionBanco(usuario, nuevo);
      aceptarPaqueteGuardado(registro, nuevo); setRevisionId(registro.id); setGrupoLote(''); setNotaLote(''); setConfirmarLote(false); setPagina(0);
      setGuardado(`${lote.movimientos.length} movimientos clasificados como “${grupoLote}” y guardados en MONYS. Versión ${registro.id}.`);
    } catch (e) { setError(e.message || 'No se pudo guardar el bloque. La revisión anterior sigue abierta.'); }
    finally { setSincronizando(false); }
  };
  const guardarGrupoBeneficiario = async () => {
    if (!confirmarPersonaLote) { setError('Confirma que la misma categoría aplica a todos los movimientos visibles del grupo.'); return; }
    try {
      const cantidad = gruposPersona.find(g => g.nombre === grupoPersonaLote)?.cantidad || 0;
      const nuevo = clasificarGrupoBeneficiario(paquete, grupoPersonaLote, categoriaPersonaLote, notaPersonaLote);
      setSincronizando(true); setError('');
      const registro = await guardarRevisionBanco(usuario, nuevo);
      aceptarPaqueteGuardado(registro, nuevo); setRevisionId(registro.id); setGrupoPersonaLote(''); setCategoriaPersonaLote(''); setNotaPersonaLote(''); setConfirmarPersonaLote(false); setPersonaGrupo(''); setGrupo(''); setPagina(0);
      setGuardado(`${cantidad} movimientos de ${grupoPersonaLote} clasificados como “${categoriaPersonaLote}” y guardados en MONYS. Versión ${registro.id}.`);
    } catch (e) { setError(e.message || 'No se pudo guardar el grupo. La revisión anterior sigue abierta.'); }
    finally { setSincronizando(false); }
  };
  const guardarClasificacionSegura = async () => {
    if (!planSeguro?.movimientos) return;
    setSincronizando(true); setError('');
    try {
      const movimientosCuenta = paquete.movimientos.filter(m => !cuenta || m.cuenta === cuenta);
      const clasificados = clasificarSugerenciasSeguras({ ...paquete, movimientos: movimientosCuenta });
      const porId = new Map(clasificados.movimientos.map(m => [m.id, m]));
      const nuevo = { ...paquete, movimientos: paquete.movimientos.map(m => porId.get(m.id) || m) };
      const registro = await guardarRevisionBanco(usuario, nuevo);
      aceptarPaqueteGuardado(registro, nuevo); setRevisionId(registro.id); setRevisarClasificacionSegura(false); setGrupo(''); setPagina(0); setEditando(null);
      setGuardado(`${planSeguro.movimientos} movimientos seguros clasificados y guardados. ${planSeguro.excepciones} excepciones siguen pendientes. Versión ${registro.id}.`);
    } catch (e) { setError(e.message || 'No se pudo guardar la clasificación segura. La revisión anterior sigue abierta.'); }
    finally { setSincronizando(false); }
  };
  const cargar = async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB.');
      const nuevo = JSON.parse(await file.text()); validarEstadoBancario(nuevo);
      const aplicado = aplicarReglasBancarias(nuevo, reglasBancarias);
      setPaquete(aplicado.paquete); setReglasSugeridas(aplicado.sugeridas); setRevisionId(null); setGuardado(''); setError(''); setPagina(0); setFiltro(''); setCuenta(''); setDireccion(''); setGrupo(''); setPendientes(false); setEditando(null);
    } catch (e) { setError(e.message || 'No fue posible leer el archivo.'); }
  };
  const guardarNube = async () => {
    setSincronizando(true); setError('');
    try { const registro = await guardarRevisionBanco(usuario, paquete); aceptarPaqueteGuardado(registro, paquete); setRevisionId(registro.id); setGuardado(`Versión guardada en MONYS: ${registro.id}. Puedes recuperarla con tu usuario, negocio y sucursal.`); }
    catch (e) { setError(e.message); } finally { setSincronizando(false); }
  };
  const recuperarNube = async () => {
    setSincronizando(true); setError('');
    try { const registro = await recuperarRevisionBanco(usuario); if (!registro) { setError('No hay una versión bancaria guardada para este contexto.'); return; } const paqueteConReglas = actualizarReglasBancarias(registro.paquete); const reglas = paqueteConReglas.reglas_bancarias || []; const aplicado = aplicarReglasBancarias(paqueteConReglas, reglas); setReglasBancarias(reglas); setReglasSugeridas(aplicado.sugeridas); setPaquete(aplicado.paquete); setRevisionId(registro.id); setGuardado('Última versión recuperada de MONYS.'); setPagina(0); setFiltro(''); setCuenta(''); setDireccion(''); setGrupo(''); setPendientes(false); setEditando(null); }
    catch (e) { setError(e.message); } finally { setSincronizando(false); }
  };
  const guardarAqui = () => {
    try { guardarRevisionBancaria(window.localStorage, clave, paquete); setGuardado('Revisión guardada en este dispositivo.'); setError(''); }
    catch { setError('No se pudo guardar en este dispositivo. Descarga tu revisión para conservarla.'); }
  };
  const recuperarAqui = () => {
    try {
      const borrador = recuperarRevisionBancaria(window.localStorage, clave);
      if (!borrador) { setError('No hay una revisión guardada para este usuario, negocio y sucursal.'); return; }
      const paqueteConReglas = actualizarReglasBancarias(borrador.paquete); const reglas = paqueteConReglas.reglas_bancarias?.length ? paqueteConReglas.reglas_bancarias : reglasBancarias; const aplicado = aplicarReglasBancarias(paqueteConReglas, reglas); setReglasBancarias(reglas); setReglasSugeridas(aplicado.sugeridas); setPaquete(aplicado.paquete); setRevisionId(null); setGuardado('Borrador recuperado de este dispositivo. Guarda una versión en MONYS antes de conciliarla.'); setError(''); setPagina(0); setFiltro(''); setCuenta(''); setDireccion(''); setGrupo(''); setPendientes(false); setEditando(null);
    } catch { setError('No se pudo recuperar un borrador válido. Abre tu archivo descargado.'); }
  };
  const descargar = () => {
    validarEstadoBancario(paquete);
    const url = URL.createObjectURL(new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'MONYS-revision-bancaria.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const confirmar = () => {
    if (!categoria || !nota.trim()) { setError('Selecciona una categoría y explica cómo confirmaste el destino.'); return; }
    setPaquete(actual => ({ ...actual, movimientos: actual.movimientos.map(m => m.id === editando ? { ...m, revision: { estado: 'Confirmado', clasificacion: categoria, nota: nota.trim(), fecha: new Date().toISOString() } } : m) })); setEditando(null); setGuardado('Clasificación confirmada en esta revisión. Pulsa Guardar versión en MONYS para conservar el cambio en otros equipos.'); setError('');
  };
  return <section className="banco-revision"><fieldset className="banco-controles" disabled={sincronizando} aria-busy={sincronizando}>
    <div className="banco-revision-head"><div><span>CONCILIACIÓN BANCARIA</span><h2>Revisa el destino de tu dinero</h2></div><label className="banco-carga">Abrir paquete bancario<input type="file" accept=".json,application/json" onChange={cargar} /></label></div>
    <p>Abre el archivo bancario MONYS preparado a partir del estado de cuenta. Se comprobarán movimientos, sumas y saldos antes de mostrarlo. Este paso admite JSON; los PDF se preparan primero.</p>
    <p className="banco-aviso">Esta revisión no cambia los saldos de Tesorería ni registra ingresos o gastos. Puedes guardarla en este dispositivo con tu usuario, negocio y sucursal, o descargarla para abrirla en otro equipo. Al entrar se carga tu última versión guardada en MONYS. Guarda los cambios antes de salir, actualizar o abrir otro paquete.</p>
    <div className="banco-filtros"><button disabled={!clave} onClick={recuperarAqui}>Recuperar revisión guardada aquí</button>{paquete && <button disabled={!clave} onClick={guardarAqui}>Guardar en este dispositivo</button>}</div>
    {usuario?.role === 'owner' && <div className="banco-nube"><h3>Guardar y continuar en otro equipo</h3><p>Conserva una versión con tu usuario, negocio y sucursal. Guardar no registra otra salida ni reemplaza las versiones anteriores.</p><div className="banco-filtros"><button disabled={sincronizando} onClick={recuperarNube}>Recuperar de MONYS</button><button disabled={sincronizando || !paquete} onClick={guardarNube}>Guardar versión en MONYS</button></div>{!paquete && <small>Abre un paquete o recupera una versión para habilitar el guardado.</small>}</div>}
    {sincronizando && <p role="status">Consultando MONYS. Espera a que termine antes de editar.</p>}
    {guardado && <p role="status">{guardado}</p>}
    {error && <p role="alert" className="banco-error">{error}</p>}
    {resumen && <>
      <div className="banco-resumen"><article><small>Saldo al cierre del estado</small><strong>{dinero(resumen.saldo)}</strong><small>No equivale a dinero disponible hoy</small></article><article><small>Control bancario</small><strong>{resumen.movimientos} movimientos</strong><small>{resumen.cuentas.length} cuentas cuadran</small></article><article><small>Por clasificar</small><strong>{paquete.movimientos.filter(m => m.revision?.estado !== 'Confirmado').length}</strong><small>Las pistas del banco requieren revisión</small></article></div>
      <div className="banco-cuentas">{resumen.cuentas.map(c => <article key={c.terminacion}><b>Cuenta ·{c.terminacion}</b><p>{c.desde} a {c.hasta}</p><p>Abonos {dinero(c.abonos)} · Cargos {dinero(c.cargos)}</p><strong>{dinero(c.final)} al cierre</strong></article>)}</div>
      <section className="banco-sugerencias">
        <h3>Cruce mensual · facturas pagadas de Flotilla</h3>
        <p>MONYS compara importe exacto y fecha del cobro contra abonos del estado de cuenta, con una ventana de tres días. Solo sugiere candidatos; no confirma ni cambia saldos.</p>
        {cargandoFacturasCruce ? <p>Consultando facturas del periodo…</p> : crucesFacturas.length === 0 ? <p>No hay facturas pagadas pendientes de cruzar en este periodo.</p> : <div className="banco-lista">{crucesFacturas.map(({ factura, candidatos, estado }) => <article key={factura.id}><div><b>Factura {factura.folio} · {factura.emisor}</b><p>Servicio {factura.periodo_desde} al {factura.periodo_hasta} · Cobro registrado {factura.pagada_en ? new Date(factura.pagada_en).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }) : 'fecha pendiente'}</p><p>{estado === 'COINCIDENCIA_UNICA' ? 'Una coincidencia posible; falta confirmar.' : estado === 'AMBIGUA' ? 'Varias coincidencias; requiere revisión.' : 'Sin coincidencia exacta en importe y fecha.'}</p>{candidatos.map((movimiento) => <div key={movimiento.id} style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#faf5f8' }}><b>{movimiento.fecha_operacion} · Cuenta ·{movimiento.cuenta} · {dinero(movimiento.abono)}</b><p>{movimiento.descripcion}</p><small>Referencia: {movimiento.referencia_visible || 'No disponible'}</small><br/><button type="button" onClick={() => { setCuenta(movimiento.cuenta); setDireccion('entrada'); setFiltro(movimiento.descripcion || ''); setPendientes(false); setPagina(0); }}>Ver abono en el estado</button></div>)}</div><strong>{dinero(factura.total)}</strong></article>)}</div>}
      </section>
      <div className="banco-filtros"><input aria-label="Buscar movimiento bancario" placeholder="Nombre, concepto o referencia" value={filtro} onChange={e => { setFiltro(e.target.value); setPagina(0); }} /><select aria-label="Cuenta bancaria" value={cuenta} onChange={e => { setCuenta(e.target.value); setPagina(0); }}><option value="">Todas las cuentas</option>{resumen.cuentas.map(c => <option key={c.terminacion} value={c.terminacion}>·{c.terminacion}</option>)}</select><select aria-label="Tipo de movimiento bancario" value={direccion} onChange={e => { setDireccion(e.target.value); setPagina(0); }}><option value="">Entradas y salidas</option><option value="entrada">Solo entradas</option><option value="salida">Solo salidas</option></select><label><input type="checkbox" checked={pendientes} onChange={e => { setPendientes(e.target.checked); setPagina(0); }} /> Solo pendientes</label><button onClick={descargar}>Descargar mi revisión</button></div>{reglasBancarias.length > 0 && <p className="banco-aviso">MONYS conserva {reglasBancarias.filter(r => r.categoria && !r.conflicto).length} reglas de clasificaciones anteriores. {reglasSugeridas ? `Encontró ${reglasSugeridas} coincidencias para revisar.` : 'Las usará cuando encuentre los mismos patrones.'} Ninguna se confirma automáticamente.</p>}
      {usuario?.role === 'owner' && planComisiones?.movimientos.length > 0 && <section className="banco-sugerencias"><h3>Avanza por bloque · comisiones identificadas</h3><p>{planComisiones.movimientos.length} cargos por {dinero(planComisiones.importe)} · {cuenta ? `Cuenta ·${cuenta}` : 'Todas las cuentas'}. Conceptos explícitos del banco; los otros pagos quedan fuera de este bloque.</p><button onClick={() => setRevisarComisiones(v => !v)}>{revisarComisiones ? 'Cerrar revisión del bloque' : 'Revisar comisiones juntas'}</button>{revisarComisiones && <div><p>Se clasificarán como Comisión bancaria / IVA y se guardará una nueva versión en MONYS. La asignación a negocio, sucursal o uso personal sigue pendiente. Los saldos bancarios se conservan y los movimientos de caja no cambian.</p><details><summary>Ver los {planComisiones.movimientos.length} cargos del bloque</summary><div className="banco-lista">{planComisiones.movimientos.map(m => <article key={m.id}><div><b>{m.descripcion}</b><p>{m.fecha_operacion} · Cuenta ·{m.cuenta}</p></div><strong>{dinero(m.cargo)}</strong></article>)}</div></details><button onClick={guardarComisiones}>Clasificar {planComisiones.movimientos.length} comisiones y guardar en MONYS</button></div>}</section>}
      {usuario?.role === 'owner' && planTerminales?.movimientos.length > 0 && <section className="banco-sugerencias"><h3>Avanza por bloque · cobros de terminal</h3><p>{planTerminales.movimientos.length} abonos por {dinero(planTerminales.importe)} · {cuenta ? `Cuenta ·${cuenta}` : 'Todas las cuentas'}. Identificados por el banco; falta conciliarlos con SICAR.</p><button onClick={() => setRevisarTerminales(v => !v)}>{revisarTerminales ? 'Cerrar revisión de terminales' : 'Revisar cobros de terminal juntos'}</button>{revisarTerminales && <div><p>Se clasificarán como Cobro de tienda: conciliar SICAR y se guardará una nueva versión. Esta acción no agrega ventas ni confirma que coinciden con caja.</p><details><summary>Ver los {planTerminales.movimientos.length} abonos del bloque</summary><div className="banco-lista">{planTerminales.movimientos.map(m => <article key={m.id}><div><b>{m.descripcion}</b><p>{m.fecha_operacion} · Cuenta ·{m.cuenta}</p></div><strong>{dinero(m.abono)}</strong></article>)}</div></details><button onClick={guardarTerminales}>Identificar {planTerminales.movimientos.length} cobros y guardar en MONYS</button></div>}</section>}
      {usuario?.role === 'owner' && planSeguro?.movimientos > 0 && <section className="banco-sugerencias banco-contador"><h3>Contador MONYS · clasificación segura</h3><p><b>{planSeguro.movimientos} movimientos</b> por {dinero(planSeguro.importe)} tienen una regla clara. MONYS puede clasificarlos ahora y dejarte solo <b>{planSeguro.excepciones} excepciones</b>.</p><button onClick={() => setRevisarClasificacionSegura(v => !v)}>{revisarClasificacionSegura ? 'Cerrar resumen' : 'Revisar resumen y clasificar'}</button>{revisarClasificacionSegura && <div><p>No se incluirán movimientos sin destino, con evidencia contradictoria ni ya confirmados. Esta acción clasifica conceptos; no mueve dinero ni duplica ventas o gastos.</p><div className="banco-cuentas">{planSeguro.grupos.map(grupo => <article key={grupo.categoria}><b>{grupo.categoria}</b><p>{grupo.movimientos.length} movimientos</p><p>{dinero(grupo.importe)}</p></article>)}</div><button onClick={guardarClasificacionSegura}>Clasificar los {planSeguro.movimientos} seguros y guardar</button></div>}</section>}
      <section className="banco-sugerencias"><h3>Revisión asistida · destinos sugeridos</h3><p>Revisa por bloques. Los movimientos sin destino claro o con evidencia ambigua quedan pendientes.</p><div className="banco-cuentas">{agruparSugerenciasBancarias(paquete.movimientos.filter(m => !cuenta || m.cuenta === cuenta)).map(g => { const lote = prepararLoteSugerido(paquete.movimientos.filter(m => !cuenta || m.cuenta === cuenta), g.nombre); return <article key={g.nombre}><b>{g.nombre}</b><p>{g.cantidad} pendientes</p><p>Salidas {dinero(g.cargos)} · Entradas {dinero(g.abonos)}</p><button onClick={() => { setGrupo(g.nombre); setFiltro(''); setDireccion(''); setPendientes(true); setPagina(0); setEditando(null); requestAnimationFrame(() => document.getElementById('banco-resultados')?.scrollIntoView({ behavior: 'smooth' })); }}>Ver movimientos</button>{lote.movimientos.length > 0 && <button onClick={() => { setGrupoLote(g.nombre); setNotaLote(notaComunDeLote(g.nombre)); setConfirmarLote(false); setError(''); }}>Revisar y clasificar {lote.movimientos.length} juntos</button>}{lote.ambiguos > 0 && <small>{lote.ambiguos} con evidencia ambigua quedarán fuera.</small>}</article>; })}</div>{gruposPersona.length > 0 && <><h4>Subgrupos por nombre detectado · siguen pendientes</h4><p>MONYS los junta por el nombre que aparece en el concepto o referencia. Revisa cada movimiento antes de asignar su destino.</p><div className="banco-cuentas">{gruposPersona.map(g => <article key={g.nombre}><b>{g.nombre === 'OSCAR' ? 'Oscar · posibles pagos o adelantos' : g.nombre}</b><p>{g.cantidad} movimientos sin destino</p><p>Salidas {dinero(g.cargos)} · Entradas {dinero(g.abonos)}</p><details><summary>Ver referencias e importes</summary><div className="banco-beneficiario-detalle">{g.movimientos.map(m => <p key={m.id}><b>{m.fecha_operacion} · Cuenta ·{m.cuenta} · {Number(m.cargo) > 0 ? `Salida ${dinero(m.cargo)}` : `Entrada ${dinero(m.abono)}`}</b><br />{m.referencia_visible || m.descripcion}</p>)}</div></details><button onClick={() => { setGrupo('Sin destino identificado'); setPersonaGrupo(g.nombre); setFiltro(''); setDireccion(''); setPendientes(true); setPagina(0); setEditando(null); }}>Ver juntos para revisar</button>{!(g.cargos > 0 && g.abonos > 0) ? <button onClick={() => { setGrupoPersonaLote(g.nombre); setCategoriaPersonaLote(''); setNotaPersonaLote(''); setConfirmarPersonaLote(false); setError(''); }}>Clasificar {g.cantidad} juntos</button> : <small>Este grupo mezcla entradas y salidas; hay que separarlas para no aplicar una sola clasificación a todo.</small>}</article>)}</div></>}{personaGrupo && <p>Subgrupo: <b>{personaGrupo === 'OSCAR' ? 'Oscar' : personaGrupo}</b> <button onClick={() => { setPersonaGrupo(''); setPagina(0); }}>Quitar filtro de nombre</button></p>}{grupoPersonaLote && (() => { const g = gruposPersona.find(x => x.nombre === grupoPersonaLote); if (!g) return null; return <div id="banco-persona-lote" className="banco-lote"><h4>Revisar el grupo de {g.nombre}</h4><p>{g.cantidad} movimientos · Salidas {dinero(g.cargos)} · Entradas {dinero(g.abonos)}. Revisa las referencias arriba y elige una categoría común.</p><label>Categoría<select value={categoriaPersonaLote} onChange={e => setCategoriaPersonaLote(e.target.value)}><option value="">Seleccionar categoría</option>{categorias.map(c => <option key={c}>{c}</option>)}</select></label><label>Nota común de auditoría<textarea value={notaPersonaLote} onChange={e => setNotaPersonaLote(e.target.value)} placeholder={`Ejemplo: adelantos a ${g.nombre}, por recuperar en su pago.`} /></label><label className="banco-lote-confirmacion"><input type="checkbox" checked={confirmarPersonaLote} onChange={e => setConfirmarPersonaLote(e.target.checked)} /> Confirmo que todos los movimientos de este grupo corresponden a esta categoría.</label><button disabled={!categoriaPersonaLote || !notaPersonaLote.trim() || !confirmarPersonaLote || sincronizando} onClick={guardarGrupoBeneficiario}>Confirmar y guardar los {g.cantidad} juntos</button><button onClick={() => { setGrupoPersonaLote(''); setConfirmarPersonaLote(false); }}>Cancelar</button></div>; })()}{grupoLote && (() => { const lote = prepararLoteSugerido(paquete.movimientos.filter(m => !cuenta || m.cuenta === cuenta), grupoLote); return <div id="banco-lote-activo" className="banco-lote"><h4>Confirmar bloque: {grupoLote}</h4><p>{lote.movimientos.length} movimientos · total {dinero(lote.importe)}. MONYS pondrá una nota de auditoría en cada movimiento. {lote.ambiguos ? `${lote.ambiguos} ambiguos no se incluirán.` : ''}</p><label>Nota de auditoría<textarea value={notaLote} onChange={e => setNotaLote(e.target.value)} /></label><label className="banco-lote-confirmacion"><input type="checkbox" checked={confirmarLote} onChange={e => setConfirmarLote(e.target.checked)} /> Confirmo que esta categoría aplica a todos los movimientos incluidos.</label><button disabled={!notaLote.trim() || !confirmarLote} onClick={guardarLoteSugerido}>Confirmar bloque y guardar en MONYS</button><button onClick={() => { setGrupoLote(''); setConfirmarLote(false); }}>Cancelar</button></div>; })()}{grupo && <p>Grupo: <b>{grupo}</b> <button onClick={() => { setGrupo(''); setPersonaGrupo(''); setPagina(0); }}>Mostrar todos los destinos</button></p>}</section>
      <CruceBancoCaja paquete={paquete} movimientos={movimientos} revisionId={revisionId} creditosProveedores={creditosProveedores} onRevisarBanco={m => {
        const coincidencias = paquete.movimientos.filter(x => x.cuenta === m.cuenta && [x.descripcion, x.referencia_visible].join(' ').toLowerCase().includes(m.descripcion.toLowerCase()));
        const indice = coincidencias.findIndex(x => x.id === m.id);
        setGrupo(''); setPersonaGrupo(''); setCuenta(m.cuenta); setDireccion(''); setFiltro(m.descripcion); setPendientes(false); setEditando(null); setPagina(Math.max(0, Math.floor(indice / 20))); setMovimientoObjetivo(m.id);
      }} />
      <DiagnosticoEstadoBancario paquete={paquete} cuenta={cuenta} onRevisar={m => {
        setGrupo(''); setCuenta(m.cuenta); setDireccion(''); setFiltro(m.descripcion); setPendientes(true);
        const candidatos = paquete.movimientos.filter(x => x.cuenta === m.cuenta && x.revision?.estado !== 'Confirmado' && [x.descripcion, x.referencia_visible, x.categoria, x.revision?.clasificacion, x.revision?.nota].join(' ').toLowerCase().includes(m.descripcion.toLowerCase()));
        setPagina(Math.max(0, Math.floor(candidatos.findIndex(x => x.id === m.id) / 20)));
        setEditando(m.id); setCategoria(sugerirMovimientoBancario(m).categoria); setNota(''); setError('');
        requestAnimationFrame(() => document.getElementById(`banco-mov-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      }} />
      <p id="banco-resultados">{filtrados.length} movimientos encontrados. Las ventas de terminal se concilian con SICAR; las transferencias entre cuentas no son ventas.</p>
      <div className="banco-lista">{filtrados.slice(pagina * 20, (pagina + 1) * 20).map(m => <article key={m.id} id={`banco-mov-${m.id}`}><div><small>{m.fecha_operacion} · Cuenta terminación ·{m.cuenta}</small><h3>{m.descripcion}</h3><p className="banco-referencia-visible"><b>Referencia bancaria:</b> {m.referencia_visible || 'Sin referencia registrada'}</p><p>{m.revision?.estado === 'Confirmado' ? m.revision.clasificacion : `Pista: ${m.categoria || 'Por aclarar'}`}</p>{m.revision?.estado !== 'Confirmado' && <p className="banco-pista">{sugerirMovimientoBancario(m).motivo}</p>}<details><summary>Más datos del movimiento</summary><p>{m.fuente} · página PDF {m.pagina_pdf} · liquida {m.fecha_liquidacion}</p>{sugerirMovimientoBancario(m).coincidencias.map((e, i) => <blockquote className="banco-whatsapp" key={i}><b>Mensaje candidato de WhatsApp · {e.fecha}</b><p>{e.texto}</p><small>Línea {e.linea} · {sugerirMovimientoBancario(m).ambigua ? 'Hay varias coincidencias; confirma cuál corresponde.' : 'Coincide fecha e importe; el destino necesita confirmación.'}</small></blockquote>)}{m.revision?.nota && <p>Tu aclaración: {m.revision.nota}</p>}</details></div><div><strong>{Number(m.cargo) > 0 ? 'Salida ' + dinero(m.cargo) : 'Entrada ' + dinero(m.abono)}</strong><p>{m.revision?.estado || 'Por revisar'}</p><button onClick={() => { setEditando(m.id); setCategoria(m.revision?.clasificacion || sugerirMovimientoBancario(m).categoria); setNota(m.revision?.nota || ''); setError(''); }}>Aclarar destino</button></div>{editando === m.id && <div className="banco-editor"><label>Clasificación<select value={categoria} onChange={e => setCategoria(e.target.value)}><option value="">Seleccionar</option>{categorias.map(c => <option key={c}>{c}</option>)}</select></label><label>Evidencia y destino<textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Ejemplo: préstamo a Oscar para uso personal, por recuperar; comprobante revisado." /></label><button onClick={confirmar}>Confirmar clasificación</button><button onClick={() => setEditando(null)}>Cancelar</button></div>}</article>)}</div>
      <div className="banco-filtros"><button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>Página {pagina + 1} de {Math.max(1, Math.ceil(filtrados.length / 20))}</span><button disabled={(pagina + 1) * 20 >= filtrados.length} onClick={() => setPagina(p => p + 1)}>Siguiente</button></div>
    </>}
  </fieldset></section>;
}
