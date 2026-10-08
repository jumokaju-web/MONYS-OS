import { consolidarFinanzasSucursales, construirComparativoSucursales } from '../shared/resumenSucursalesFinanciero';
import './CentroMando.css';

export default function CentroMando({ sucursales = [], movimientos = [], movimientosDisponibles = true, onAbrirDirector, onAbrirImportador }) {
  const consolidado = consolidarFinanzasSucursales(sucursales);
  const filas = construirComparativoSucursales(sucursales);
  const dinero = (valor) => valor === null || valor === undefined ? 'Sin reporte' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor);
  const pendientes = movimientos.filter((m) => ['pendiente de revisión', 'en revisión'].includes(String(m.estado ?? m.status ?? '').toLowerCase())).length;
  const mayorVenta = Math.max(1, ...filas.map((f) => f.ventas ?? 0));
  const prioridad = !consolidado.disponible ? 'Alinear los reportes de ambas tiendas' : pendientes ? `Resolver ${pendientes} movimientos pendientes` : 'Completar el cierre y revisar las campañas';
  const motivo = !consolidado.disponible ? consolidado.motivo : pendientes ? 'Las salidas sin revisar pueden cambiar el resultado y la capacidad de compra.' : 'El margen bruto está disponible; caja, banco y gastos deben confirmarse antes de decidir una nueva inversión.';
  return <section className="mando">
    <header className="mando-header"><span className="mando-marca">MONYS<span>OS</span></span><span className="mando-chip">CENTRO DE MANDO · DATOS CARGADOS</span></header>
    <div className="mando-hero"><div><p className="mando-kicker">DIRECCIÓN DEL NEGOCIO</p><h2>Tu negocio.<br /><em>La siguiente decisión.</em></h2><p>Ventas, dinero y equipo conectados con lo que necesitas hacer ahora.</p></div><div className="mando-corte"><span>CORTE ANALIZADO</span><strong>{consolidado.disponible ? `${consolidado.fechaInicial} → ${consolidado.fechaFinal}` : 'Reportes por completar'}</strong><small>Las cifras cambian con tus importaciones reales.</small></div></div>
    <div className="mando-metricas">
      <article><span>VENTAS SICAR</span><strong>{dinero(consolidado.ventas)}</strong><small>Ambas sucursales, mismo corte</small></article>
      <article><span>UTILIDAD BRUTA</span><strong>{dinero(consolidado.utilidad)}</strong><small>Antes de gastos operativos</small></article>
      <article><span>MARGEN BRUTO</span><strong>{consolidado.disponible ? `${consolidado.margen.toFixed(1)}%` : 'Sin reporte'}</strong><small>Porcentaje sobre ventas</small></article>
      <article><span>TESORERÍA POR REVISAR</span><strong>{movimientosDisponibles ? pendientes : "Por cargar"}</strong><small>Movimientos cargados pendientes</small></article>
    </div>
    <div className="mando-grid"><article className="mando-prioridad"><div className="mando-kicker">01 · TU SIGUIENTE PASO</div><h3>{prioridad}</h3><p>{motivo}</p><div className="mando-etiquetas"><span>Evitar decisiones con datos incompletos</span><span>Responsable: dirección</span></div><button data-vista="financiero" onClick={() => consolidado.disponible ? onAbrirDirector?.('financiero') : onAbrirImportador?.()}>{consolidado.disponible ? 'Revisar el cierre financiero' : 'Subir reportes SICAR'} <span>→</span></button></article>
      <article className="mando-sucursales"><div className="mando-kicker">EL NEGOCIO POR SUCURSAL</div><h3>Dónde se genera el margen</h3>{filas.length ? filas.map((f) => <div className="mando-fila" key={f.id}><div><strong>{f.nombre}</strong><b>{dinero(f.ventas)}</b></div><div className="mando-barra"><span style={{ width: `${Math.max(0, (f.ventas ?? 0) / mayorVenta * 100)}%` }} /></div><small>Utilidad bruta {dinero(f.utilidadBruta)} · {f.margenBruto === null ? 'Margen pendiente' : `${f.margenBruto.toFixed(1)}%`}<br />{f.periodoEtiqueta || 'Periodo pendiente'}</small></div>) : <p>Importa utilidad de ventas para ver el comparativo.</p>}<small>Las barras comparan ventas registradas. Revisa que los cortes coincidan antes de comparar sucursales.</small></article></div>
    <div className="mando-rutas">
      {[['financiero','02','Finanzas','Completa caja, banco y gastos. Revisa préstamos y descarga el cierre.','Abrir cierre'],['marketing','03','Marketing','Ordena las campañas por presupuesto y resultados que faltan.','Ver prioridades'],['rh','04','Equipo','Consulta empleadas, roles y datos de personal registrados.','Abrir RH']].map(([id,n,t,d,b]) => <article key={id}><span className="mando-numero">{n}</span><h3>{t}</h3><p>{d}</p><button data-vista={id} onClick={() => onAbrirDirector?.(id)}>{b} →</button></article>)}
    </div><footer>REAL: reportes cargados · PENDIENTE: cierre y conciliación · Las barras no representan saldo bancario ni utilidad neta.</footer>
  </section>;
}
