import React, { useState } from "react";
import "./ResultadoMensual.css";
const mxn = new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"});
const valid = Number.isFinite;
const money = v => valid(v) ? mxn.format(v) : "Pendiente";
const month = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || "") ? new Intl.DateTimeFormat("es-MX",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(m+"-01T00:00:00Z")) : "Periodo pendiente";
function Metric({label,value,status,subtotal}) {
  return <div className="rm-metric"><small>{label}</small><strong>{money(value)}</strong><small>{valid(value) ? status : "Pendiente"}</small>{!valid(value) && valid(subtotal?.valor) && <details><summary>Subtotal conocido: {money(subtotal.valor)}</summary><p>Incluye: {(subtotal.incluye || []).join(", ")}</p><p>Falta: {(subtotal.faltan || []).join(", ")}</p></details>}</div>;
}
export default function ResultadoMensual({tablero,loading=false,onDetalle}) {
  const [selected,setSelected] = useState("");
  if (loading) return <p role="status">Cargando resultado mensual…</p>;
  if (tablero?.estado !== "listo") return <p role="status">{tablero?.motivo || "Resultado pendiente"}</p>;
  const estados = [...(tablero.estados || [])].sort((a,b)=>b.mes.localeCompare(a.mes));
  const e = estados.find(s=>s.mes===selected) || estados[0];
  if (!e) return <p>No hay periodos disponibles.</p>;
  const c=e.consolidado || {};
  const provisional=!!e.provisional?.length || !!e.parcial || !c.completo || !!tablero.errores?.length;
  const status=({alta:"Confirmado",media:"Con reservas",baja:"Provisional"})[e.confianza] || "Pendiente";
  const estimatedISR=String(c.tipoIsr || "").startsWith("ESTIMADO");
  const headline=[["Utilidad neta",c.utilidadNeta],["Utilidad antes de ISR",c.utilidadAntesISR],["Utilidad operativa devengada",c.utilidadOperativa?.devengado]].find(([,v])=>valid(v)) || ["Utilidad neta",null];
  return <section className="rm-root">
    <header><small>MONYS OS · Finanzas</small><h1>Resultado del mes</h1><label>Periodo<select value={e.mes} onChange={ev=>setSelected(ev.target.value)}>{estados.map(s=><option key={s.mes} value={s.mes}>{month(s.mes)}</option>)}</select></label></header>
    {provisional && <details className="rm-warning"><summary>Resultado provisional</summary>{!!tablero.errores?.length && <p>Algunas fuentes no están disponibles.</p>}<ul>{(e.provisional || []).map((x,i)=><li key={i}>{typeof x==="string"?x:x?.motivo || "Dato por confirmar"}</li>)}</ul></details>}
    <div className="rm-hero"><Metric label={headline[0]} value={headline[1]} status={headline[0]==="Utilidad neta" && estimatedISR ? "Estimado · ISR" : status}/><small>La utilidad no equivale al efectivo disponible.</small></div>
    <div className="rm-grid">
      <Metric label="Ingresos" value={c.ingresos} status={status} subtotal={e.subtotalConocido?.ingresos}/>
      <Metric label="Costo de mercancía" value={c.costoMercancia} status={status} subtotal={e.subtotalConocido?.costoMercancia}/>
      <Metric label="Utilidad bruta" value={c.utilidadBruta} status={status} subtotal={e.subtotalConocido?.utilidadBruta}/>
      <Metric label="Utilidad operativa devengada" value={c.utilidadOperativa?.devengado} status={status}/>
      <Metric label="Utilidad operativa base pagada" value={c.utilidadOperativa?.pagado} status={status}/>
      <Metric label="Utilidad neta" value={c.utilidadNeta} status={estimatedISR?"Estimado · ISR":status}/>
    </div>
    <h2>Sucursales y canales</h2>
    {(e.unidades || []).map((u,i)=><article className="rm-unit" key={u.unidad || i}><h3>{u.nombre || "Unidad"}</h3><small>{u.tipo==="canal"?"Canal digital":"Sucursal"}</small><Metric label={valid(u.ingresos)?"Ingresos":"Ingresos registrados hasta ahora"} value={valid(u.ingresos)?u.ingresos:u.ingresosRegistrados} status={valid(u.ingresos)?status:"Parcial"}/><Metric label="Contribución devengada" value={u.contribucionDevengado} status={status}/><Metric label="Contribución base pagada" value={u.contribucionPagado} status={status}/></article>)}
    {!!e.faltantes?.length && <details><summary>Datos pendientes · {e.faltantes.length}</summary><ul>{e.faltantes.map((x,i)=><li key={i}>{typeof x==="string"?x:x?.motivo || "Dato pendiente"}</li>)}</ul></details>}
    <button type="button" disabled={typeof onDetalle!=="function"} onClick={()=>onDetalle?.(e.mes)}>Ver estado de resultados</button>
  </section>;
}
