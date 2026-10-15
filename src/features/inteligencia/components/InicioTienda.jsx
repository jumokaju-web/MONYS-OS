import { useLayoutEffect, useRef, useState } from 'react';
import OperacionEmpleado from './OperacionEmpleado';
import CierreTurno from './CierreTurno';
import RegistroProductoSolicitado from './RegistroProductoSolicitado';
import RegistroEntradaOperativa from './RegistroEntradaOperativa';
import PerfilOperativoEmpleado from './PerfilOperativoEmpleado';
import IncidenciaTienda from './IncidenciaTienda';

export default function InicioTienda({ usuario, datosDashboard, branchId, puedeRegistrarProducto, cerrarSesion }) {
  const [vista, setVista] = useState('HOY');
  const [visitadas, setVisitadas] = useState(['HOY']);
  const destino = useRef(null);
  const primeraVista = useRef(true);
  const opciones = [['HOY','⌂','Hoy'], ...(puedeRegistrarProducto ? [['PRODUCTO','S','Solicitudes']] : []), ['INCIDENCIAS','!','Incidencias'], ['CAJA','$','Caja y cierre']];
  function abrir(id) { setVista(id); setVisitadas(v => v.includes(id) ? v : [...v, id]); }
  useLayoutEffect(() => {
    if (primeraVista.current) { primeraVista.current = false; return; }
    destino.current?.scrollIntoView({ block: 'start' });
    destino.current?.focus({ preventScroll: true });
  }, [vista]);
  return <main className="tienda-shell">
    <header className="tienda-header"><div><span>MONYS OS · MI TIENDA</span><h1>Hola, {usuario?.nombre || 'equipo'}</h1><p>{usuario?.sucursal || 'Sucursal por confirmar'} · {usuario?.puesto || 'Operación de tienda'}</p></div><button type="button" onClick={cerrarSesion}>Salir</button></header>
    <div className="tienda-contenido">
      <section className="tienda-accesos" aria-label="Accesos de tienda"><div><span>TODO A UN TOQUE</span><h2>¿Qué necesitas registrar?</h2></div><div className="tienda-accesos-grid">{opciones.filter(([id]) => id !== 'HOY').map(([id,icono,titulo]) => <button type="button" key={id} onClick={() => abrir(id)} aria-pressed={vista===id}><span aria-hidden="true">{icono}</span><b>{titulo}</b><small>{id==='CAJA'?'Foto, cobros y efectivo':id==='INCIDENCIAS'?'Reportar lo que pasó':'Producto que pidió un cliente'}</small></button>)}</div></section>
      <h2 className="tienda-vista-titulo" ref={destino} tabIndex={-1}>{opciones.find(([id])=>id===vista)?.[2]}</h2>
      <section hidden={vista!=='HOY'} aria-label="Trabajo de hoy"><RegistroEntradaOperativa usuario={usuario}/><details className="tienda-perfil"><summary>Mi perfil y responsabilidades</summary><PerfilOperativoEmpleado usuario={usuario}/></details><OperacionEmpleado branchId={branchId} usuario={usuario} datosDashboard={datosDashboard}/></section>
      {visitadas.includes('PRODUCTO') && <section hidden={vista!=='PRODUCTO'} aria-label="Registrar solicitud"><RegistroProductoSolicitado branchId={branchId} usuario={usuario}/></section>}
      {visitadas.includes('INCIDENCIAS') && <section hidden={vista!=='INCIDENCIAS'} aria-label="Registrar incidencia"><IncidenciaTienda branchId={branchId} usuario={usuario}/></section>}
      {visitadas.includes('CAJA') && <section hidden={vista!=='CAJA'} aria-label="Caja y cierre"><CierreTurno branchId={branchId} usuario={usuario} modoEmpleado/></section>}
    </div>
    <nav className="tienda-nav" aria-label="Navegación de tienda">{opciones.map(([id,icono,titulo])=><button key={id} type="button" onClick={()=>abrir(id)} aria-current={vista===id?'page':undefined}><span aria-hidden="true">{icono}</span><b>{titulo}</b></button>)}</nav>
  </main>;
}
