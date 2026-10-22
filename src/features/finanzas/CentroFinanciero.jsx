import { useEffect, useRef, useState } from 'react';
import DirectorFinanciero from '../inteligencia/components/director-finanzas/DirectorFinanciero';
import TesoreriaPage from '../tesoreria/pages/TesoreriaPage';
import RevisionEstadoBancario from '../tesoreria/components/RevisionEstadoBancario';
import './CentroFinanciero.css';
import { obtenerCreditosProveedoresActuales } from '../inteligencia/services/creditosProveedoresService';
import BandejaCapturasEquipo from './components/BandejaCapturasEquipo';
import DisponibilidadFinancieraHoy from './components/DisponibilidadFinancieraHoy';

const areas = [
  ['equipo', 'Capturas del equipo', 'Cortes y flotilla'],
  ['bancos', 'Bancos y aclaraciones', 'Estados, evidencia y destino'],
  ['control', 'Movimientos', 'Entradas, salidas y revisión'],
  ['plan', 'Planeación financiera', 'Equilibrio, proveedores y flujo'],
];

export default function CentroFinanciero({ datosDashboard, sucursalesDashboard, movimientos, formatoDinero, onMovimientoGuardado, onCambiarEstado, onAbrirImportador, volverAlDashboard }) {
  const [creditos, setCreditos] = useState({ importacion: null, creditos: [], saldoTotal: 0 });
  const [errorCreditos, setErrorCreditos] = useState('');
  const [tab, setTab] = useState('equipo');
  const areaActivaRef = useRef(null);
  const branchId = datosDashboard?.branch_id;

  useEffect(() => {
    let activo = true;
    setCreditos({ importacion: null, creditos: [], saldoTotal: 0 });
    setErrorCreditos('');
    obtenerCreditosProveedoresActuales(branchId)
      .then((resultado) => { if (activo) setCreditos(resultado); })
      .catch((error) => { if (activo) setErrorCreditos(error.message || 'No se pudieron cargar los créditos.'); });
    return () => { activo = false; };
  }, [branchId]);

  useEffect(() => {
    if (tab === 'equipo') return undefined;
    const frame = requestAnimationFrame(() => {
      areaActivaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab]);

  const abrirArea = (id) => setTab(id);
  const abrirEquilibrio = () => {
    abrirArea('plan');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('equilibrio-diario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  };

  return (
    <main className="centro-financiero">
      <header className="finanzas-portada">
        <div className="finanzas-top">
          <span>MONYS OS · DIRECCIÓN FINANCIERA</span>
          <button onClick={volverAlDashboard}>Volver al inicio</button>
        </div>
        <h1>Tu dinero. Tus decisiones.</h1>
        <button type="button" className="finanzas-meta-diaria" onClick={abrirEquilibrio}>Ver mi punto de equilibrio diario →</button>
        <p>Revisa el banco, controla los movimientos y planea cómo sostener tu negocio.</p>
        <div className="finanzas-ruta" aria-label="Ruta financiera">
          <button type="button" onClick={() => abrirArea('equipo')}>01 · Recibir cortes</button>
          <button type="button" onClick={() => abrirArea('bancos')}>02 · Verificar banco</button>
          <button type="button" onClick={() => abrirArea('control')}>03 · Explicar destino</button>
          <button type="button" onClick={() => abrirArea('plan')}>04 · Planear</button>
        </div>
      </header>

      {errorCreditos && <p role="alert">{errorCreditos}</p>}

      <nav className="finanzas-tabs" aria-label="Áreas financieras">
        {areas.map(([id, titulo, detalle]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => abrirArea(id)}>
            <b>{titulo}</b><small>{detalle}</small>
          </button>
        ))}
      </nav>

      <section ref={areaActivaRef} className="finanzas-area-activa" aria-live="polite">
        {tab === 'equipo' && <>
          <BandejaCapturasEquipo branchId={branchId} sucursales={sucursalesDashboard} />
          <div className="finanzas-fuentes">
            <p><b>Estado de los datos:</b> los reportes enviados al chat no se importan automáticamente a MONYS. Los borradores bancarios se guardan en este dispositivo; las cifras del negocio usan las importaciones registradas.</p>
            <button onClick={onAbrirImportador}>Cargar reportes del negocio →</button>
          </div>
          <section className="finanzas-evidencias">
            <h2>Gastos: tres fuentes, un solo registro</h2>
            <div className="finanzas-tabs">
              <article><b>Estados bancarios</b><p>Pagos y cobros comprobados por el banco. Revisa el destino en Bancos y aclaraciones.</p><button type="button" onClick={() => abrirArea('bancos')}>Revisar bancos →</button></article>
              <article><b>Movimientos de caja SICAR</b><p>Entradas y salidas de tienda. Importa el reporte y revisa los movimientos registrados.</p><button type="button" onClick={onAbrirImportador}>Importar SICAR →</button><button type="button" onClick={() => abrirArea('control')}>Ver movimientos →</button></article>
              <article><b>WhatsApp y comprobantes</b><p>Explican para qué se pagó y a quién. Falta cruzarlos con banco y caja antes de sumar gastos.</p><button type="button" onClick={() => abrirArea('bancos')}>Revisar evidencia bancaria →</button></article>
            </div>
            <p>El mismo pago puede aparecer en varias fuentes. La conciliación entre fuentes está pendiente; no se suman automáticamente para calcular utilidad.</p>
          </section>
          <DisponibilidadFinancieraHoy branchId={branchId} sucursales={sucursalesDashboard} creditosProveedores={creditos} onAbrirArea={abrirArea} />
        </>}
        {tab === 'bancos' && <section aria-label="Bancos y aclaraciones"><RevisionEstadoBancario movimientos={movimientos} /></section>}
        {tab === 'control' && <section aria-label="Movimientos"><TesoreriaPage ocultarRevisionBancaria volverAlDashboard={volverAlDashboard} onMovimientoGuardado={onMovimientoGuardado} movimientos={movimientos} formatoDinero={formatoDinero} onCambiarEstado={onCambiarEstado} /></section>}
        {tab === 'plan' && <section aria-label="Planeación financiera"><DirectorFinanciero creditosProveedores={creditos} datosDashboard={datosDashboard} sucursalesDashboard={sucursalesDashboard} movimientos={movimientos} onAbrirImportador={onAbrirImportador} /></section>}
      </section>
    </main>
  );
}
