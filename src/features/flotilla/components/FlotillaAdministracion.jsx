import { useState } from 'react';
import FlotillaOperacionEnVivo from './FlotillaOperacionEnVivo';
import FlotillaPrefacturas from './FlotillaPrefacturas';
import FlotillaIncidencias from './FlotillaIncidencias';
import FlotillaPnr from './FlotillaPnr';
import FlotillaPrestamos from './FlotillaPrestamos';
import FlotillaResumenRentalPeriodo from './FlotillaResumenRentalPeriodo';
import FlotillaAccesosChofer from './FlotillaAccesosChofer';
import FlotillaAccesosSocios from './FlotillaAccesosSocios';
import ResumenFlotillaSocios from './ResumenFlotillaSocios';
import './flotillaAdministracion.css';

const SECCIONES_FLOTILLA = [
  { id: 'HOY', titulo: 'Hoy', detalle: 'Rutas, gasolina y adelantos', icono: '↗', principal: true },
  { id: 'SEMANA', titulo: 'Semana', detalle: 'Revisar y descargar prefacturas', icono: '▦', principal: true },
  { id: 'EVIDENCIAS', titulo: 'Evidencias', detalle: 'Fotos y reportes por fecha', icono: '▧', principal: true },
  { id: 'PNR', titulo: 'PNR', detalle: 'Investigar y dar seguimiento', icono: '◇' },
  { id: 'DINERO', titulo: 'Préstamos', detalle: 'Préstamos y abonos registrados', icono: '$' },
  { id: 'RENTAL', titulo: 'Rental', detalle: 'Corte diario y resultado semanal', icono: '↔' },
  { id: 'ACCESOS', titulo: 'Accesos', detalle: 'Choferes y permisos de consulta', icono: '⌁' },
  { id: 'SOCIOS', titulo: 'Socios', detalle: 'Distribución de rutas por unidad', icono: '◎' },
];

export default function FlotillaAdministracion({ usuario, unidades = [], soloConsulta = false, puedeGestionarPnr = false }) {
  const [vista, setVista] = useState('INICIO');
  const [visitadas, setVisitadas] = useState([]);
  const disponibles = SECCIONES_FLOTILLA.filter(s =>
    (s.id !== 'PNR' || puedeGestionarPnr) && (s.id !== 'ACCESOS' || !soloConsulta));
  const actual = disponibles.find(s => s.id === vista);
  function abrir(id) {
    setVista(id);
    setVisitadas(v => v.includes(id) ? v : [...v, id]);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
  const panel = (id, contenido) => visitadas.includes(id)
    ? <div key={id} hidden={vista !== id} role="region" aria-label={SECCIONES_FLOTILLA.find(s => s.id === id)?.titulo}>{contenido}</div>
    : null;

  return <div className="flotilla-admin">
    <nav className="flotilla-admin-nav" aria-label="Secciones de Flotilla">
      {[{ id: 'INICIO', titulo: 'Inicio' }, ...disponibles].map(s => <button key={s.id} type="button" aria-current={vista === s.id ? 'page' : undefined} onClick={() => abrir(s.id)}>{s.titulo}</button>)}
    </nav>
    {vista === 'INICIO' ? <>
      <header className="flotilla-admin-bienvenida">
        <div><span className="flotilla-admin-eyebrow">IMPERPAQ · {soloConsulta ? 'CONSULTA' : 'ADMINISTRACIÓN'}</span>
          <h1>Hola, {usuario?.nombre?.split(' ')[0] || 'equipo'}</h1>
          <p>Tu flotilla, en orden. Elige lo que necesitas revisar.</p>
        </div>
        <div className="flotilla-admin-alcance"><strong>{unidades.length}</strong><span>unidades autorizadas</span></div>
      </header>
      <div className="flotilla-admin-principales">
        {disponibles.filter(s => s.principal).map(s => <button type="button" key={s.id} onClick={() => abrir(s.id)}><span className="flotilla-admin-icono">{s.icono}</span><strong>{s.titulo}</strong><span>{s.detalle}</span><b aria-hidden="true">Abrir →</b></button>)}
      </div>
      <h2 className="flotilla-admin-subtitulo">Más herramientas</h2>
      <div className="flotilla-admin-herramientas">{disponibles.filter(s => !s.principal).map(s => <button type="button" key={s.id} onClick={() => abrir(s.id)}><span className="flotilla-admin-icono">{s.icono}</span><span><strong>{s.titulo}</strong><small>{s.detalle}</small></span><span aria-hidden="true">→</span></button>)}</div>
      <p className="flotilla-admin-nota">Hoy y la semana cerrada se consultan por separado. Las cifras aparecen al abrir cada sección.</p>
    </> : <div className="flotilla-admin-titulo"><button type="button" onClick={() => abrir('INICIO')}>← Inicio</button><div><h1>{actual?.titulo}</h1><p>{actual?.detalle}</p></div></div>}

    {(visitadas.includes('HOY') || visitadas.includes('RENTAL')) && <div hidden={!['HOY', 'RENTAL'].includes(vista)}><FlotillaOperacionEnVivo usuario={usuario} soloConsulta={soloConsulta} seccion={vista === 'RENTAL' ? 'RENTAL' : 'HOY'} /></div>}
    {panel('SEMANA', <FlotillaPrefacturas usuario={usuario} puedeGestionar={!soloConsulta} />)}
    {panel('EVIDENCIAS', <FlotillaIncidencias modoAdministracion soloConsulta={soloConsulta} unidades={unidades} />)}
    {puedeGestionarPnr && panel('PNR', <FlotillaPnr modoAdministracion />)}
    {panel('DINERO', <FlotillaPrestamos soloConsulta={soloConsulta} />)}
    {!soloConsulta && panel('ACCESOS', <><FlotillaAccesosChofer />{String(usuario?.role || '').toLowerCase() === 'owner' && <FlotillaAccesosSocios />}</>)}
    {panel('SOCIOS', <ResumenFlotillaSocios unidades={unidades} />)}
    {!soloConsulta && visitadas.includes('RENTAL') && <div hidden={vista !== 'RENTAL'}><FlotillaResumenRentalPeriodo /></div>}
  </div>;
}
