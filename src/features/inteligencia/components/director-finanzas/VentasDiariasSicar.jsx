import { useMemo } from 'react';
import { construirVentasDiariasSicar } from '../../utils/ventasDiariasSicar';
const dinero=n=>n===null?'Sin dato':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(n);
const dia=f=>new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${f}T12:00:00Z`));
export default function VentasDiariasSicar({ paquetes=[], sucursales=[], cargando=false, error='', onAbrirImportador }) {
  const grupos=useMemo(()=>construirVentasDiariasSicar(paquetes,Object.fromEntries(sucursales.map(s=>[s.id,s.nombre||s.name]))),[paquetes,sucursales]);
  return <section aria-label="Ventas por día de la semana" style={{margin:'20px 0',padding:18,border:'1px solid #ead4df',borderRadius:18,background:'#fff'}}>
    <h3 style={{marginTop:0}}>¿Qué días vendes más?</h3>
    <p>Venta y utilidad bruta de tickets SICAR. La comparación usa el mismo día de la semana anterior cuando existe un reporte comparable.</p>
    {cargando?<p>Consultando fechas de los tickets…</p>:error?<p role="alert">No se pudo comprobar el desglose diario. Actualiza los reportes o vuelve a abrir este módulo.</p>:!grupos.length?<p>Falta un reporte “Utilidad de ventas” con fechas por ticket y periodo identificado.</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:22}}>{grupos.map(g=>{
      const maximo=Math.max(1,...g.filas.map(f=>f.ventas??0));
      return <article key={g.branchId} style={{borderTop:'1px solid #ead4df',paddingTop:14,marginTop:16}}>
        <h4>{g.nombre} · {g.inicio} al {g.fin}</h4>
        {g.completa?<p><b>Mayor venta:</b> {g.fuertes.map(f=>`${dia(f.fecha)}: ${dinero(f.ventas)}`).join(' / ')}. <b>Menor venta:</b> {g.debiles.map(f=>`${dia(f.fecha)}: ${dinero(f.ventas)}`).join(' / ')}.</p>:<p role="status">Hay fechas o importes por confirmar. No se declara un día más fuerte o más débil con una semana incompleta.</p>}
        <div role="img" aria-label={`Ventas diarias de ${g.nombre}`} style={{display:'grid',gap:10}}>
          {g.filas.map(f=><div key={f.fecha}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><span>{dia(f.fecha)}</span><b>{dinero(f.ventas)}</b></div>
            <div style={{height:9,background:'#f5e9ef',borderRadius:10,marginTop:5}}>{f.ventas!==null&&<div style={{height:'100%',width:`${Math.max(0,f.ventas)/maximo*100}%`,background:g.nombre.toLowerCase().includes('anaya')?'#b88d4b':'#a82c68',borderRadius:10}}/>}</div>
          </div>)}
        </div>
        <details style={{marginTop:14}}><summary>Ver utilidad bruta y comparación por día</summary><div style={{overflowX:'auto'}}><table style={{width:'100%'}}><caption>{g.nombre} · fuente: {g.fuente}</caption><thead><tr><th>Día</th><th>Venta</th><th>Semana anterior</th><th>Cambio</th><th>Utilidad bruta</th></tr></thead><tbody>{g.filas.map(f=><tr key={f.fecha}><th>{dia(f.fecha)}</th><td>{dinero(f.ventas)}</td><td>{dinero(f.anterior)}</td><td>{f.variacion===null?'Sin comparación':`${f.variacion>=0?'+':''}${f.variacion.toFixed(1)}%`}</td><td>{dinero(f.utilidadBruta)}</td></tr>)}</tbody></table></div></details>
        <p><b>Revisión propuesta:</b> {g.completa?'prepara existencias y atención para el día de mayor venta; prueba una acción medible en el día de menor venta y compara venta y margen antes de repetirla.':'completa las fechas faltantes antes de cambiar horarios o promociones.'}</p>
        <small>Lectura del periodo, no un patrón estable ni una causa comprobada. Un día sin tickets se muestra sin dato; no se supone que estuvo abierto ni que vendió cero.</small>
      </article>;
    })}</div>}
    <p><b>Ganancia neta y equilibrio:</b> pendientes de gastos reales y costos variables. La utilidad bruta ya descuenta mercancía; todavía no descuenta toda la operación.</p>
    {onAbrirImportador&&<button type="button" onClick={onAbrirImportador}>Actualizar reportes SICAR</button>}
  </section>;
}
