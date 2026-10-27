import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabase';
import { fechaActualMexico } from '../../inteligencia/services/asistenciaOperativaService';
import { importeCorte, resumirCortesHoy } from '../utils/cortesHoy';
import CapturaCorteRecibido from './CapturaCorteRecibido';

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const mostrar = valor => importeCorte(valor) === null ? 'Por confirmar' : dinero.format(Number(valor));

export default function CortesHoyDireccion({ usuario, sucursales = [] }) {
  const [estado, setEstado] = useState({ registros: [], fecha: fechaActualMexico(), actualizado: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const ramas = useMemo(() => {
    const lista = sucursales.filter(s => s?.id && (!s.business_id || s.business_id === usuario?.business_id));
    if (usuario?.branch_id && !lista.some(s => s.id === usuario.branch_id)) lista.push({ id: usuario.branch_id, nombre: usuario.sucursal || 'Sucursal asignada' });
    return [...new Map(lista.map(s => [s.id, s])).values()];
  }, [sucursales, usuario?.branch_id, usuario?.business_id, usuario?.sucursal]);
  const claveRamas = ramas.map(r => r.id).sort().join(',');
  useEffect(() => {
    let vigente = true;
    let consultando = false;
    async function cargar() {
      if (consultando) return;
      consultando = true; setCargando(true); setError('');
      const fecha = fechaActualMexico();
      try {
        if (!claveRamas || !usuario?.business_id) throw new Error('Falta identificar las sucursales del negocio.');
        const { data, error: fallo } = await supabase.from('cierres_turno')
          .select('id,branch_id,responsable,turno,fecha,created_at,observaciones')
          .in('branch_id', claveRamas.split(',')).eq('fecha', fecha)
          .order('created_at', { ascending: false }).limit(501);
        if (fallo) throw fallo;
        if ((data || []).length > 500) throw new Error('Hay demasiados registros para este resumen. Revisa los cortes en Finanzas.');
        if (vigente) setEstado({ registros: data || [], fecha, actualizado: new Date() });
      } catch (e) { if (vigente) setError(e.message || 'No pudimos consultar los cortes.'); }
      finally { consultando = false; if (vigente) setCargando(false); }
    }
    cargar();
    const reloj = setInterval(() => { if (document.visibilityState !== 'hidden') cargar(); }, 60_000);
    return () => { vigente = false; clearInterval(reloj); };
  }, [claveRamas, usuario?.business_id, revision]);
  const resumen = resumirCortesHoy(estado.registros, estado.fecha);
  const nombres = new Map(ramas.map(r => [r.id, r.nombre || r.name || 'Sucursal']));
  const pendiente = cargando || Boolean(error);
  return <section aria-labelledby="cortes-hoy-titulo" style={{ margin: '16px 0', padding: 20, background: '#fff', border: '1px solid #e6cdda', borderRadius: 20 }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
      <div><small>HOY · REPORTES DEL EQUIPO</small><h2 id="cortes-hoy-titulo" style={{ margin: '6px 0' }}>Cortes recibidos de las tiendas</h2></div>
      <button type="button" style={{ minHeight: 44 }} onClick={() => setRevision(n => n + 1)} disabled={cargando}>{cargando ? 'Consultando…' : 'Actualizar cortes'}</button>
    </header>
    <p>Importes capturados por las empleadas, pendientes de revisión. No se suman al corte semanal SICAR ni equivalen a dinero disponible.</p>
    {error ? <p role="alert">No se pudo comprobar el estado actual: {error}</p> : <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <div><small>Cortes recibidos</small><p style={{ margin: '6px 0', fontWeight: 850 }}>{pendiente ? 'Consultando…' : resumen.cortes.length}</p></div>
        <div><small>Venta reportada en cortes</small><p style={{ margin: '6px 0', fontWeight: 850 }}>{pendiente ? 'Consultando…' : resumen.ventaReportada === null ? 'Por confirmar' : mostrar(resumen.ventaReportada)}</p></div>
        <div><small>Cortes con diferencias</small><p style={{ margin: '6px 0', fontWeight: 850 }}>{pendiente ? 'Consultando…' : `${resumen.conDiferencias}${resumen.diferenciasPendientes ? ` · ${resumen.diferenciasPendientes} por confirmar` : ''}`}</p></div>
      </div>
      {!pendiente && !resumen.cortes.length && <p role="status">Todavía no hay cortes enviados hoy. La entrada o una tarea “En proceso” no representan un corte recibido.</p>}
      {!pendiente && resumen.cajasRepetidas && <p role="status">Hay más de un corte de la misma caja y turno, o cortes antiguos sin turno identificado. Revísalos antes de sumar las ventas.</p>}
      {!pendiente && resumen.incompletos > 0 && <p>{resumen.incompletos} cortes tienen datos por completar; el total queda por confirmar.</p>}
      {!pendiente && resumen.cortes.map(({ cierre, datos, venta, diferencia, diferenciaVenta }) => <details key={cierre.id} style={{ padding: '14px 0', borderTop: '1px solid #eadce5' }}>
        <summary style={{ cursor: 'pointer', lineHeight: 1.7 }}><b>{nombres.get(cierre.branch_id)} · {datos.cajaNombre || datos.cajaId || 'Caja por identificar'} · {datos.turnoCajaNombre || ({ MATUTINO: 'Mañana', VESPERTINO: 'Tarde / noche', COMPLETO: 'Día completo' })[datos.turnoCaja] || 'Turno por confirmar'}</b> · {cierre.responsable || 'Responsable por confirmar'} · {mostrar(venta)} · recibido {new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' }).format(new Date(cierre.created_at))}</summary>
        {datos.registroFueraDeFlujo && <p style={{ padding: 10, borderRadius: 10, background: '#fff5df', fontWeight: 750 }}>Recibido por {datos.fuenteCaptura === 'WHATSAPP' ? 'WhatsApp' : 'un canal externo'} y capturado por {datos.capturadoPorDireccion || 'Dirección'}. Responsable original: {datos.responsableCierre || cierre.responsable || 'por confirmar'}.</p>}
        {datos.registroFueraDeFlujo && <p>Motivo: {datos.detalleMotivoRegistroTardio || datos.motivoRegistroTardio || 'Pendiente de documentar'}</p>}
        <p>Efectivo de ventas: {mostrar(datos.efectivoVentas)} · Tarjeta: {mostrar(datos.tarjeta)} · Transferencias: {mostrar(datos.transferencias)}</p>
        <p>Diferencia de caja: {mostrar(diferencia)} · Diferencia entre cobros y venta: {mostrar(diferenciaVenta)}</p>
        <p>{datos.fotoCortePath || datos.fotoCorteUrl ? 'Foto adjunta · pendiente de revisar' : 'Foto pendiente'} · Contrastar con el corte SICAR</p>
      </details>)}
    </>}
    <small>{estado.fecha} · actualización automática cada minuto mientras esta pantalla esté visible{estado.actualizado && !error && !cargando ? ` · última consulta ${estado.actualizado.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' })}` : ''}</small>
    <CapturaCorteRecibido usuario={usuario} sucursales={ramas} onGuardado={() => setRevision(n => n + 1)} />
  </section>;
}
