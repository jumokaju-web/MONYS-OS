import { useLayoutEffect, useRef, useState } from 'react';
import OperacionEmpleado from './OperacionEmpleado';
import CierreTurno from './CierreTurno';
import RegistroProductoSolicitado from './RegistroProductoSolicitado';
import RegistroEntradaOperativa from './RegistroEntradaOperativa';
import PerfilOperativoEmpleado from './PerfilOperativoEmpleado';
import IncidenciaTienda from './IncidenciaTienda';
import AsistenteWhatsAppTienda from './AsistenteWhatsAppTienda';
import { borrarBorradoresUsuario } from '../utils/borradorCorte';
import { crearRutaTurnoTienda } from '../shared/accesosTienda';

export default function InicioTienda({ usuario, datosDashboard, branchId, puedeRegistrarProducto, puedeWhatsApp = false, puedeRegistrarIncidencias = false, puedeCaja = false, cerrarSesion }) {
  const [vista, setVista] = useState('HOY');
  const [revisionTareas, setRevisionTareas] = useState(0);
  const [visitadas, setVisitadas] = useState(['HOY']);
  const destino = useRef(null);
  const primeraVista = useRef(true);
  const opciones = [
    ['HOY', '⌂', 'Mi día'],
    ...(puedeWhatsApp ? [['WHATSAPP', 'W', 'WhatsApp']] : []),
    ...(puedeRegistrarProducto ? [['PRODUCTO', 'S', 'Solicitudes']] : []),
    ...(puedeRegistrarIncidencias ? [['INCIDENCIAS', '!', 'Incidencias']] : []),
    ...(puedeCaja ? [['CAJA', '$', 'Cierre']] : []),
  ];
  const rutaTurno = crearRutaTurnoTienda({
    puedeRegistrarProducto,
    puedeWhatsApp,
    puedeRegistrarIncidencias,
    puedeCaja,
  });
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
      titulo: 'Caja y cierre',
      descripcion: 'Deja completo el resultado del turno. Si falta un dato, se conserva como pendiente y no se convierte en cero.',
    },
  };
  function abrir(id) { setVista(id); setVisitadas(v => v.includes(id) ? v : [...v, id]); }
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
  const vistaActual = detalleVista[vista];

  return <main className="tienda-shell">
    <header className="tienda-header"><div><span>MONYS OS · MI TIENDA</span><h1>Hola, {usuario?.nombre || 'equipo'}</h1><p>{usuario?.sucursal || 'Sucursal por confirmar'} · {usuario?.puesto || 'Operación de tienda'}</p></div><button type="button" onClick={salir}>Salir</button></header>
    <div className={`tienda-contenido${vista !== 'HOY' ? ' tienda-contenido--subvista' : ''}`}>
      <section className="tienda-home" hidden={vista !== 'HOY'} ref={vista === 'HOY' ? destino : null} tabIndex={-1} aria-label="Trabajo de hoy">
        <RegistroEntradaOperativa usuario={usuario} onEntradaRegistrada={() => setRevisionTareas(n => n + 1)}/>
        <div className="tienda-home-intro">
          <p className="tienda-kicker">TU TURNO · {usuario?.sucursal || 'SUCURSAL'}</p>
          <h2>Haz lo importante y deja evidencia</h2>
          <p>Esta es tu ruta del día. MONYS conserva lo que registras para que Dirección pueda decidir con datos reales.</p>
          <ol className="tienda-ruta" aria-label="Ruta del turno">
            {rutaTurno.map((paso, indice) => <li key={paso.titulo}><span>{indice + 1}</span><div><strong>{paso.titulo}</strong><small>{paso.descripcion}</small></div></li>)}
          </ol>
        </div>
        <section className="tienda-accesos" aria-label="Accesos de tienda"><div><span>REGISTRO RÁPIDO</span><h2>¿Qué necesitas hacer?</h2></div><div className="tienda-accesos-grid">{opciones.filter(([id]) => id !== 'HOY').map(([id,icono,titulo]) => <button type="button" key={id} onClick={() => abrir(id)}><span aria-hidden="true">{icono}</span><b>{titulo}</b><small>{id==='CAJA'?'Foto, cobros y efectivo':id==='INCIDENCIAS'?'Reportar lo que pasó':id==='WHATSAPP'?'Preparar una respuesta segura':'Producto que pidió una clienta'}</small></button>)}</div></section>
        <div className="tienda-trabajo-titulo"><p className="tienda-kicker">TRABAJO ASIGNADO</p><h2>Tu día en una sola vista</h2><p>Empieza por lo pendiente y actualiza cada tarea cuando cambie su estado.</p></div>
        <OperacionEmpleado revisionAsistencia={revisionTareas} branchId={branchId} usuario={usuario} datosDashboard={datosDashboard}/>
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
      {puedeRegistrarIncidencias && visitadas.includes('INCIDENCIAS') && <section hidden={vista!=='INCIDENCIAS'} aria-label="Registrar incidencia"><IncidenciaTienda branchId={branchId} usuario={usuario}/></section>}
      {puedeCaja && visitadas.includes('CAJA') && <section hidden={vista!=='CAJA'} aria-label="Caja y cierre"><CierreTurno key={`${usuario?.auth_user_id || usuario?.id}:${branchId}`} branchId={branchId} usuario={usuario} modoEmpleado/></section>}
    </div>
    <nav className="tienda-nav" aria-label="Navegación de tienda">{opciones.map(([id,icono,titulo])=><button key={id} type="button" onClick={()=>abrir(id)} aria-current={vista===id?'page':undefined}><span aria-hidden="true">{icono}</span><b>{titulo}</b></button>)}</nav>
  </main>;
}
