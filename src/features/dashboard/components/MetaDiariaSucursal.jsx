import React from "react";
import "./MetaDiariaSucursal.css";
const fmt=new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"});
const money=v=>Number.isFinite(v)?fmt.format(v):"Pendiente";
function Target({title,data,assumption=false}){
 return <div className="md-target"><h3>{title}</h3><small>{assumption?"Estimado · reparto supuesto de gastos generales":"Estimado · según datos disponibles"}</small><strong>{money(data?.ventaDiaria)}</strong><small>Venta diaria necesaria</small><p>Meta mensual: {money(data?.ventaMensual)}</p><p>{!Number.isFinite(data?.brechaDiaria)?"Brecha pendiente":data.brechaDiaria<0?"Te faltan "+money(Math.abs(data.brechaDiaria))+" al día":data.brechaDiaria>0?"Vas "+money(data.brechaDiaria)+" arriba al día":"En la meta diaria"}</p></div>;
}
export default function MetaDiariaSucursal({tablero,loading=false}){
 if(loading)return <p role="status">Cargando metas…</p>;
 if(tablero?.estado!=="listo")return <p role="status">{tablero?.motivo||"Información pendiente"}</p>;
 const eq=tablero.equilibrio;
 const branches=eq?.porSucursal?.sucursales;
 return <section className="md-root"><header><h1>¿Cuánto debo vender hoy?</h1><p>Mes objetivo: {eq?.mesObjetivo||"Pendiente"}</p><small>Base histórica: {eq?.mesBase||"Pendiente"}</small></header>
 {!!tablero.errores?.length&&<p role="status">Información parcial: algunas fuentes no están disponibles.</p>}
 <p>La meta diaria es una estimación, no una garantía de utilidad ni de efectivo. La meta operativa y la de efectivo no se suman.</p>
 {!branches?.length&&<p>Faltan datos para calcular metas por sucursal.</p>}
 {(branches||[]).map((s,i)=><article className="md-branch" key={s.branchId||s.unidad||i}><h2>{s.nombre}</h2><small>Promedio diario del mes base</small><strong>{money(s.ventaDiariaActual)}</strong><p>Margen de contribución: {Number.isFinite(s.margenContribucionPct)?s.margenContribucionPct+"%":"Pendiente"}</p><p>Días con venta esperada: {Number.isFinite(s.diasConVentaEsperada)?s.diasConVentaEsperada:"Pendiente"}</p>
 <Target title="Cubrir operación" data={s.operativo}/>
 <Target title="Cubrir pagos de la sucursal" data={s.efectivo}/>
 {s.operativoConGenerales&&<details><summary>Escenario con gastos generales</summary><Target title="Operación con gastos generales" data={s.operativoConGenerales} assumption/></details>}
 {!!s.faltantes?.length&&<details open><summary>Datos pendientes</summary><ul>{s.faltantes.map((f,j)=><li key={j}>{typeof f==="string"?f:f?.motivo||"Dato pendiente"}</li>)}</ul></details>}
 {!!s.avisos?.length&&<details><summary>Supuestos y avisos</summary><ul>{s.avisos.map((f,j)=><li key={j}>{typeof f==="string"?f:f?.motivo||"Aviso pendiente"}</li>)}</ul></details>}
 </article>)}
 </section>;
}
