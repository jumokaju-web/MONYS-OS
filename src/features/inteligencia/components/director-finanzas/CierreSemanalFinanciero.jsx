import { useState } from 'react';

export default function CierreSemanalFinanciero({ metricas = {}, analisis, formatoDinero, consolidacionValida = false, motivo }) {
  const [confirmaciones, setConfirmaciones] = useState({});
  const inicio = metricas.fechaInicial;
  const fin = metricas.fechaFinal;
  const periodo = `${inicio || 'Sin fecha'} · ${fin || 'Sin fecha'}`;
  const confirmado = confirmaciones[periodo] || {};
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
      ...controles.map(([clave, etiqueta]) => [etiqueta, confirmado[clave] ? 'Confirmado' : 'Pendiente', 'Confirmación de esta sesión']),
    ];
    const csv = '\uFEFF' + filas.map((fila) => fila.map((celda) => `"${String(celda).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a'); enlace.href = url; enlace.download = 'MONYS-cierre-financiero.csv'; enlace.click(); URL.revokeObjectURL(url);
  };
  return <section style={{ padding: 22, background: '#fff4f8', border: '1px solid #e9bed0', borderRadius: 18, marginBottom: 24 }}>
    <h2>Cierre semanal · completar reportes</h2>
    <p><strong>{periodo}</strong> · {listo ? 'Base confirmada para revisión final' : `${pendientes.length} comprobaciones pendientes`}</p>
    <p>{consolidacionValida ? "Las sucursales tienen un corte comparable." : (motivo || "Falta confirmar el mismo corte de las dos sucursales.")}</p>
    <p>Confirma cada punto después de revisar los reportes. Las confirmaciones pertenecen a esta sesión y este corte; no sustituyen un cierre contable guardado.</p>
    {controles.map(([clave, etiqueta]) => <label key={clave} style={{ display: 'block', padding: '8px 0' }}><input type="checkbox" checked={Boolean(confirmado[clave])} onChange={(evento) => setConfirmaciones((previo) => ({ ...previo, [periodo]: { ...previo[periodo], [clave]: evento.target.checked } }))} /> {etiqueta}</label>)}
    <p><strong>{analisis.movimientosPendientes} movimientos cargados pendientes de revisión.</strong> Corrígelos en Tesorería antes de completar el cierre.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
      <div><strong>Utilidad después de gastos</strong><p>{listo ? formatoDinero(analisis.utilidadNetaEstimada) : 'Pendiente de completar reportes'}</p><small>Estimación con los gastos registrados del corte.</small></div>
      <div><strong>Meta diaria de equilibrio</strong><p>{objetivoDiario === null ? 'Pendiente de completar reportes' : formatoDinero(objetivoDiario)}</p><small>Gastos fijos ÷ margen de contribución ÷ días del corte. No representa una meta anual.</small></div>
    </div>
    <button type="button" onClick={exportar}>Descargar cierre y pendientes</button>
  </section>;
}
