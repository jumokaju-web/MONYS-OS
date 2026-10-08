import { useState } from 'react';
import { useUser } from '../../../../context/UserContext';
import { claveBorradorCierre, leerBorradorCierre, guardarBorradorCierre } from '../../utils/borradorCierreFinanciero';

export default function CierreSemanalFinanciero({ metricas = {}, analisis, formatoDinero, consolidacionValida = false, motivo, revisionFuentes = "", onAbrirImportador }) {
  const { usuario } = useUser();
  const [borradores, setBorradores] = useState({});
  const inicio = metricas.fechaInicial;
  const fin = metricas.fechaFinal;
  const periodo = `${inicio || 'Sin fecha'} · ${fin || 'Sin fecha'}`;
  const clave = claveBorradorCierre(usuario, inicio, fin);
  const revision = JSON.stringify([consolidacionValida, metricas.diasAnalizados, analisis.ventasTotales, analisis.costoTotal, analisis.utilidadTotal, analisis.gastosFijos, analisis.gastosVariables, analisis.movimientosPendientes, revisionFuentes]);
  const identidad = JSON.stringify([clave, revision]);
  let almacenado;
  try { almacenado = leerBorradorCierre(window.localStorage, clave, revision); }
  catch { almacenado = { confirmaciones: {}, estado: 'error' }; }
  const borrador = borradores[identidad] || almacenado;
  const confirmado = borrador.confirmaciones;
  const cambiarConfirmacion = (campo, valor) => {
    const nuevas = { ...confirmado, [campo]: valor };
    let guardado = false;
    try { guardado = guardarBorradorCierre(window.localStorage, clave, revision, nuevas); } catch { /* Continúa en memoria cuando el dispositivo bloquea el almacenamiento. */ }
    setBorradores((previo) => ({ ...previo, [identidad]: { confirmaciones: nuevas, estado: guardado ? 'guardado' : 'error' } }));
  };
  const controles = [
    ['ventas', 'Ventas y utilidad SICAR de ambas tiendas con el mismo corte'],
    ['caja', 'Movimientos de caja SICAR completos y revisados'],
    ['banco', 'Movimientos bancarios comparados con caja y comprobantes'],
    ['gastos', 'Renta, nómina, servicios y demás gastos del corte completos'],
    ['prestamos', 'Préstamos, aportaciones y pagos de créditos separados; duplicados resueltos'],
  ];
  const pendientes = controles.filter(([clave]) => !confirmado[clave]);
  const dias = Number(metricas.diasAnalizados);
  const tienePeriodo = Boolean(inicio && fin && dias > 0);
  const listo = consolidacionValida && tienePeriodo && pendientes.length === 0 && analisis.movimientosPendientes === 0;
  const equilibrio = analisis.puntoEquilibrioVentas;
  const objetivoDiario = listo && equilibrio !== null && Number.isFinite(equilibrio) ? equilibrio / dias : null;
  const exportar = () => {
    const filas = [
      ['Concepto', 'Valor', 'Estado'],
      ['Periodo', periodo, listo ? 'Confirmado para revisión final' : 'Incompleto'],
      ['Ventas SICAR', analisis.ventasTotales, 'Datos cargados'],
      ['Costo mercancía', analisis.costoTotal, 'Datos cargados'],
      ['Utilidad bruta', analisis.utilidadTotal, 'Antes de gastos'],
      ['Gastos fijos revisados', analisis.gastosFijos, 'Registros cargados'],
      ['Gastos variables revisados', analisis.gastosVariables, 'Registros cargados'],
      ['Resultado después de gastos registrados', listo ? analisis.utilidadNetaEstimada : '', listo ? 'Estimación del corte' : 'Pendiente de completar'],
      ['Meta diaria de equilibrio', objetivoDiario ?? '', 'Estimación con gastos del corte'],
      ...controles.map(([clave, etiqueta]) => [etiqueta, confirmado[clave] ? 'Confirmado' : 'Pendiente', 'Borrador de revisión, no cierre contable definitivo']),
    ];
    const csv = '\uFEFF' + filas.map((fila) => fila.map((celda) => `"${String(celda).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a'); enlace.href = url; enlace.download = 'MONYS-cierre-financiero.csv'; enlace.click(); URL.revokeObjectURL(url);
  };
  return <section style={{ padding: 22, background: '#fff4f8', border: '1px solid #e9bed0', borderRadius: 18, marginBottom: 24 }}>
    <h2>Cierre semanal · completar reportes</h2>
    <details style={{ background: '#fff', padding: 14, borderRadius: 12, marginBottom: 14 }}>
      <summary><strong>Qué subir y dónde · guía para completar el cierre</strong></summary>
      <ol>
        <li><strong>Utilidad de ventas SICAR:</strong> un archivo por sucursal, ambos con exactamente la misma fecha inicial y final. Aporta ventas, costo y utilidad bruta.</li>
        <li><strong>Movimientos de caja SICAR:</strong> ambas sucursales y el mismo corte; después revisa préstamos, retiros, aportaciones y gastos en Tesorería.</li>
        <li><strong>Estados o movimientos bancarios:</strong> cubre todo el corte. Si cruza de mes, usa los dos periodos; para el mes en curso sirve la consulta de movimientos. El Importador SICAR no procesa estados bancarios: se revisan por separado para conciliar Tesorería.</li>
        <li><strong>Gastos y nómina:</strong> completa renta, servicios, pagos de personal y comprobantes del periodo. Una salida de caja o banco puede corresponder al mismo gasto; vincula las evidencias.</li>
      </ol>
      <p>Importa primero, revisa los pendientes y luego confirma la lista del cierre. Conserva los archivos originales para revisar diferencias.</p>
      {typeof onAbrirImportador === 'function' && <button type="button" onClick={onAbrirImportador}>Abrir Importador de reportes SICAR</button>}
    </details>
    <p><strong>{periodo}</strong> · {listo ? 'Base confirmada para revisión final' : `${pendientes.length} comprobaciones pendientes`}</p>
    <p>{consolidacionValida ? "Las sucursales tienen un corte comparable." : (motivo || "Falta confirmar el mismo corte de las dos sucursales.")}</p>
    <p>Confirma cada punto después de revisar los reportes. El avance se conserva en este dispositivo por usuario y periodo. No se sincroniza entre dispositivos ni sustituye un cierre contable definitivo.</p>
    <p role="status">{borrador.estado === 'error' ? 'No se pudo guardar el avance en este dispositivo. Descarga el cierre para conservarlo.' : borrador.estado === 'sin_identidad' ? 'Falta identificar usuario, negocio o periodo para guardar el borrador.' : borrador.estado === 'datos_cambiaron' ? 'Los datos cambiaron desde tu última revisión. Confirma nuevamente los puntos con los reportes actualizados.' : borrador.estado === 'recuperado' ? 'Avance recuperado de este dispositivo.' : borrador.estado === 'guardado' ? 'Avance guardado en este dispositivo.' : 'Marca las comprobaciones para guardar tu avance.'}</p>
    {controles.map(([clave, etiqueta]) => <label key={clave} style={{ display: 'block', padding: '8px 0' }}><input type="checkbox" checked={Boolean(confirmado[clave])} onChange={(evento) => cambiarConfirmacion(clave, evento.target.checked)} /> {etiqueta}</label>)}
    <p><strong>{analisis.movimientosPendientes} movimientos cargados pendientes de revisión.</strong> Corrígelos en Tesorería antes de completar el cierre.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
      <div><strong>Utilidad después de gastos</strong><p>{listo ? formatoDinero(analisis.utilidadNetaEstimada) : 'Pendiente de completar reportes'}</p><small>Estimación con los gastos registrados del corte.</small></div>
      <div><strong>Meta diaria de equilibrio</strong><p>{objetivoDiario === null ? 'Pendiente de completar reportes' : formatoDinero(objetivoDiario)}</p><small>Gastos fijos ÷ margen de contribución ÷ días del corte. No representa una meta anual.</small></div>
    </div>
    <button type="button" onClick={exportar}>Descargar cierre y pendientes</button>
  </section>;
}
