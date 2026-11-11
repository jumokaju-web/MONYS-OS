import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabase';
import OperacionEmpleado from './OperacionEmpleado';
import CierreTurno from './CierreTurno';
import RegistroProductoSolicitado from './RegistroProductoSolicitado';
import RegistroEntradaOperativa from './RegistroEntradaOperativa';
import PerfilOperativoEmpleado from './PerfilOperativoEmpleado';
import IncidenciaTienda from './IncidenciaTienda';
import AsistenteWhatsAppTienda from './AsistenteWhatsAppTienda';
import { borrarBorradoresUsuario } from '../utils/borradorCorte';
import { crearRutaTurnoTienda, resolverSiguienteAccionTurno } from '../shared/accesosTienda';
import { resumirProgresoTurno, saludoTurno } from '../shared/progresoTurnoEmpleado';

export default function InicioTienda({ usuario, datosDashboard, branchId, responsabilidades = [], puedeRegistrarProducto, puedeWhatsApp = false, puedeRegistrarIncidencias = false, puedeCaja = false, operaSola = false, cerrarSesion }) {
  const [vista, setVista] = useState('HOY');
  const [revisionTareas, setRevisionTareas] = useState(0);
  const [visitadas, setVisitadas] = useState(['HOY']);
  const [estadoJornada, setEstadoJornada] = useState({ cargando: true, entradaRegistrada: false, salidaRegistrada: false });
  const [resumenTareas, setResumenTareas] = useState({ cargando: true, pendientes: 0, enProceso: 0, terminadas: 0 });
  const [corteGuardado, setCorteGuardado] = useState(null);
  const [incidenciaInicial, setIncidenciaInicial] = useState(null);
  const [sucursalNombre, setSucursalNombre] = useState(usuario?.sucursal || datosDashboard?.branch_name || '');
  const destino = useRef(null);
  const primeraVista = useRef(true);
  const opciones = [
    ['HOY', '⌂', 'Mi día'],
    ...(puedeWhatsApp ? [['WHATSAPP', 'W', 'WhatsApp']] : []),
    ...(puedeRegistrarProducto ? [['PRODUCTO', 'S', 'Solicitudes']] : []),
    ...(puedeRegistrarIncidencias ? [['INCIDENCIAS', '!', 'Incidencias']] : []),
    ...(puedeCaja ? [['CAJA', '$', 'Caja y corte']] : []),
  ];
  const rutaTurno = crearRutaTurnoTienda({
    puedeRegistrarProducto,
    puedeWhatsApp,
    puedeRegistrarIncidencias,
    puedeCaja,
  });
  const siguienteAccion = resolverSiguienteAccionTurno({
    jornadaCargando: estadoJornada.cargando,
    entradaRegistrada: estadoJornada.entradaRegistrada,
    salidaRegistrada: estadoJornada.salidaRegistrada,
    tareasCargando: resumenTareas.cargando,
    tareasPendientes: resumenTareas.pendientes,
    tareasEnProceso: resumenTareas.enProceso,
  });
  const progreso = resumirProgresoTurno({
    entradaRegistrada: estadoJornada.entradaRegistrada,
    tareasCargando: resumenTareas.cargando,
    pendientes: resumenTareas.pendientes,
    enProceso: resumenTareas.enProceso,
    terminadas: resumenTareas.terminadas,
  });
  const primerNombre = String(usuario?.nombre || 'equipo').trim().split(/\s+/)[0];
  const sucursalVisible = usuario?.cobertura_sucursal?.nombre || sucursalNombre || 'Sucursal por confirmar';
  const detalleVista = {
    WHATSAPP: {
      kicker: 'AYUDA PARA CONVERTIR MENSAJES EN VENTAS',
      titulo: 'Responder WhatsApp',
      descripcion: 'Prepara una respuesta clara sin inventar precio ni existencia. Tú la revisas, copias y envías.',
    },
    PRODUCTO: {
      kicker: 'LO QUE PIDIÓ LA CLIENTA',
      titulo: 'Registrar solicitud',
      descripcion: 'Guarda el producto que no encontró. Dirección verá la demanda real antes de decidir una compra o un traspaso.',
    },
    INCIDENCIAS: {
      kicker: 'LO QUE NECESITA ATENCIÓN',
      titulo: 'Reportar incidencia',
      descripcion: 'Registra qué pasó, qué hiciste y qué apoyo necesitas para que Dirección pueda darle seguimiento.',
    },
    CAJA: {
      kicker: 'ANTES DE TERMINAR',
      titulo: 'Caja y corte',
      descripcion: 'Deja completo el resultado del turno. Si falta un dato, se conserva como pendiente y no se convierte en cero.',
    },
  };
  function abrir(id) { setVista(id); setVisitadas(v => v.includes(id) ? v : [...v, id]); }
  function reportarProblemaTarea(tarea) {
    const titulo = String(tarea?.titulo || 'Tarea asignada').trim();
    setIncidenciaInicial({ id: String(tarea?.id || titulo) + '-' + Date.now(), texto: 'No pude continuar con la tarea “' + titulo + '” porque: ' });
    abrir('INCIDENCIAS');
  }
  function abrirSiguienteAccion() {
    if (siguienteAccion.id === 'ENTRADA') {
      document.getElementById('employee-attendance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (siguienteAccion.id === 'TAREAS' || siguienteAccion.id === 'PLAN') {
      document.getElementById('employee-work-today')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function salir() {
    try { borrarBorradoresUsuario(window.localStorage, usuario); } catch { /* El cierre de sesión debe continuar aunque el navegador bloquee almacenamiento. */ }
    cerrarSesion();
  }
  useLayoutEffect(() => {
    if (primeraVista.current) { primeraVista.current = false; return; }
    if (typeof window !== 'undefined') {
      window.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    destino.current?.focus({ preventScroll: true });
  }, [vista]);
  useEffect(() => {
    let activo = true;
    if (usuario?.sucursal || datosDashboard?.branch_name || !branchId) return () => { activo = false; };
    supabase.from('branches').select('name').eq('id', branchId).maybeSingle().then(({ data, error }) => {
      if (!activo) return;
      if (!error && data?.name) setSucursalNombre(data.name);
    });
    return () => { activo = false; };
  }, [branchId, datosDashboard?.branch_name, usuario?.sucursal]);
  const vistaActual = detalleVista[vista];

  return <main className="tienda-shell">
    <header className="tienda-header"><div><span>MONYS OS · MI TIENDA</span><h1>{saludoTurno()}, {primerNombre} 🌸</h1><p><b>{sucursalVisible}</b> · {usuario?.puesto || 'Operación de tienda'}</p></div><button type="button" onClick={salir}>Salir</button></header>
    <div className={`tienda-contenido${vista !== 'HOY' ? ' tienda-contenido--subvista' : ''}`}>
      <section className="tienda-home" hidden={vista !== 'HOY'} ref={vista === 'HOY' ? destino : null} tabIndex={-1} aria-label="Trabajo de hoy">
        {usuario?.cobertura_sucursal && <section role="status" style={{ display: 'grid', gap: 7, padding: 16, marginBottom: 14, border: '2px solid #a82c68', borderRadius: 16, background: '#fff4f8', color: '#50263a' }}>
          <small style={{ fontWeight: 900, letterSpacing: '.08em', color: '#9a3568' }}>COBERTURA AUTORIZADA DE HOY</small>
          <strong style={{ fontSize: 20 }}>Estás operando en {usuario.cobertura_sucursal.nombre}</strong>
          <p style={{ margin: 0, lineHeight: 1.45 }}>Entradas, tareas y cortes se registrarán en esta sucursal únicamente durante el {usuario.cobertura_sucursal.fecha}.</p>
          {usuario.cobertura_sucursal.motivo && <small>Motivo: {usuario.cobertura_sucursal.motivo}</small>}
        </section>}
        {operaSola && <section className="tienda-modo-sola" aria-label="Modo sola en tienda">
          <div><span aria-hidden="true">🌸</span><div><small>MODO SOLA EN TIENDA</small><strong>Primero atiende a la clienta</strong></div></div>
          <p>MONYS organiza lo demás alrededor de la venta. Los conteos pueden esperar a un momento tranquilo y nunca deben hacerte perder una clienta.</p>
          <ol><li><b>1</b> Clienta presente</li><li><b>2</b> Pedido o envío con hora límite</li><li><b>3</b> Tarea e inventario asignado</li></ol>
        </section>}
        <section className="tienda-progreso" aria-label="Progreso de mi día">
          <div className="tienda-progreso__encabezado">
            <div><small>MI AVANCE DE HOY</small><strong>{progreso.porcentaje === null ? 'Preparando…' : `${progreso.porcentaje}% completo`}</strong></div>
            <span aria-hidden="true">{progreso.porcentaje === 100 ? '🏆' : progreso.accionesCompletas > 0 ? '✨' : '🌷'}</span>
          </div>
          <div className="tienda-progreso__barra" aria-hidden="true"><span style={{ width: `${progreso.porcentaje || 0}%` }}/></div>
          <p>{progreso.mensaje}</p>
          {progreso.porcentaje !== null && <small>{progreso.accionesCompletas} de {progreso.totalAcciones} acciones completas</small>}
        </section>
        <section aria-label="Siguiente acción" style={{ display: 'grid', gap: 8, padding: 16, marginBottom: 14, border: '1px solid #d9b5c9', borderRadius: 16, background: 'linear-gradient(135deg,#6f3154 0%,#8f2858 100%)', color: '#fff' }}>
          <small style={{ fontWeight: 900, letterSpacing: '.08em', opacity: .82 }}>SIGUIENTE ACCIÓN</small>
          <strong style={{ fontSize: 20 }}>{siguienteAccion.titulo}</strong>
          <p style={{ margin: 0, lineHeight: 1.45, color: '#f7eaf1' }}>{siguienteAccion.descripcion}</p>
          {!['REVISANDO', 'FINALIZADO'].includes(siguienteAccion.id) && <button type="button" onClick={abrirSiguienteAccion} style={{ minHeight: 46, marginTop: 4, border: 0, borderRadius: 12, background: '#fff', color: '#76254f', fontWeight: 900 }}>{siguienteAccion.id === 'ENTRADA' ? 'Ir a registrar entrada' : siguienteAccion.id === 'TAREAS' ? 'Abrir mi trabajo' : 'Revisar y actualizar tareas'}</button>}
        </section>
        <RegistroEntradaOperativa usuario={usuario} branchId={branchId} puedeCaja={puedeCaja} onAbrirCaja={() => abrir('CAJA')} onEntradaRegistrada={() => setRevisionTareas(n => n + 1)} onEstadoCambio={setEstadoJornada}/>
        <div className="tienda-trabajo-titulo"><p className="tienda-kicker">TRABAJO ASIGNADO</p><h2>Lo que te toca hoy</h2><p>Aquí aparecen tus tareas, zona de limpieza y conteos. Empieza por lo pendiente.</p></div>
        <div id="employee-work-today" style={{ scrollMarginTop: 92 }}><OperacionEmpleado revisionAsistencia={revisionTareas} branchId={branchId} usuario={usuario} datosDashboard={datosDashboard} onResumenCambio={setResumenTareas} onAbrirCorte={() => abrir('CAJA')} onReportarProblema={puedeRegistrarIncidencias ? reportarProblemaTarea : null} corteGuardado={corteGuardado}/></div>
        <details className="tienda-herramientas">
          <summary><span>＋</span><div><strong>Registrar algo más</strong><small>Producto solicitado, incidencia, WhatsApp o caja</small></div></summary>
          <section className="tienda-accesos" aria-label="Accesos de tienda"><div><span>REGISTRO RÁPIDO</span><h2>¿Qué necesitas hacer?</h2></div><div className="tienda-accesos-grid">{opciones.filter(([id]) => id !== 'HOY').map(([id,icono,titulo]) => <button type="button" key={id} onClick={() => abrir(id)}><span aria-hidden="true">{icono}</span><b>{titulo}</b><small>{id==='CAJA'?'Foto, cobros y efectivo':id==='INCIDENCIAS'?'Reportar lo que pasó':id==='WHATSAPP'?'Preparar una respuesta segura':'Producto que pidió una clienta'}</small></button>)}</div></section>
        </details>
        {(responsabilidades.includes('PEDIDOS_EN_LINEA') || responsabilidades.includes('ENVIOS_TIENDA') || responsabilidades.includes('PROPONER_REPOSICION')) && <section className="tienda-supervendedora" aria-label="Herramientas de supervendedora">
          <p className="tienda-kicker">VENTA EN LÍNEA Y REPOSICIÓN</p><h2>Tu operación especial</h2>
          <div>
            {responsabilidades.includes('PEDIDOS_EN_LINEA') && <article><span>🧾</span><strong>Pedidos en línea</strong><small>MONYS te asignará pedidos con producto, resultado y hora de revisión.</small></article>}
            {responsabilidades.includes('ENVIOS_TIENDA') && <article><span>📦</span><strong>Envíos</strong><small>Prepara el paquete y deja guía o evidencia en la tarea asignada.</small></article>}
            {responsabilidades.includes('PROPONER_REPOSICION') && <article><span>↔️</span><strong>Reposición</strong><small>Reporta el faltante; Mónica o Kary autorizan compra o traspaso.</small></article>}
          </div>
        </section>}
        <details className="tienda-ruta-plegada">
          <summary>Ver la guía completa de mi turno</summary>
          <div className="tienda-home-intro">
            <p className="tienda-kicker">TU TURNO · {sucursalVisible}</p>
            <h2>Haz lo importante y deja evidencia</h2>
            <p>MONYS conserva lo que registras para que Dirección pueda decidir con datos reales.</p>
            <ol className="tienda-ruta" aria-label="Ruta del turno">
              {rutaTurno.map((paso, indice) => <li key={paso.titulo}><span>{indice + 1}</span><div><strong>{paso.titulo}</strong><small>{paso.descripcion}</small></div></li>)}
            </ol>
          </div>
        </details>
        <details className="tienda-perfil"><summary>Mi perfil y reglas de trabajo</summary><PerfilOperativoEmpleado usuario={usuario}/></details>
      </section>
      {vistaActual && <header className="tienda-pagina-header" ref={destino} tabIndex={-1}>
        <button className="tienda-pagina-volver" type="button" onClick={() => abrir('HOY')}>← Volver a mi día</button>
        <p className="tienda-kicker">{vistaActual.kicker}</p>
        <h2>{vistaActual.titulo}</h2>
        <p>{vistaActual.descripcion}</p>
      </header>}
      {visitadas.includes('PRODUCTO') && <section hidden={vista!=='PRODUCTO'} aria-label="Registrar solicitud"><RegistroProductoSolicitado branchId={branchId} usuario={usuario}/></section>}
      {visitadas.includes('WHATSAPP') && <section hidden={vista!=='WHATSAPP'} aria-label="Asistente de WhatsApp"><AsistenteWhatsAppTienda usuario={usuario} organizationId={usuario?.organization_id || datosDashboard?.organization_id || null} businessId={usuario?.business_id || datosDashboard?.business_id || null} branchId={branchId}/></section>}
      {puedeRegistrarIncidencias && visitadas.includes('INCIDENCIAS') && <section hidden={vista!=='INCIDENCIAS'} aria-label="Registrar incidencia"><IncidenciaTienda branchId={branchId} usuario={usuario} incidenciaInicial={incidenciaInicial}/></section>}
      {puedeCaja && visitadas.includes('CAJA') && <section hidden={vista!=='CAJA'} aria-label="Caja y cierre"><CierreTurno key={`${usuario?.auth_user_id || usuario?.id}:${branchId}`} branchId={branchId} usuario={usuario} modoEmpleado onCorteGuardado={setCorteGuardado}/></section>}
    </div>
    <nav className="tienda-nav" aria-label="Navegación de tienda">{opciones.map(([id,icono,titulo])=><button key={id} type="button" onClick={()=>abrir(id)} aria-current={vista===id?'page':undefined}><span aria-hidden="true">{icono}</span><b>{titulo}</b></button>)}</nav>
  </main>;
}
