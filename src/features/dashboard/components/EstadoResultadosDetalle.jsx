import React, {useState} from "react";
import "./EstadoResultadosDetalle.css";
const mxn=new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"});
const known=Number.isFinite;
const money=v=>known(v)?mxn.format(v):"Pendiente";
const labels={iva:"IVA",isrPagado:"ISR pagado",capitalDeuda:"Capital de deuda",compraInventario:"Compra de inventario",retiros:"Retiros",impuestosSinTipo:"Impuestos pendientes de clasificar",financiamiento:"Entradas de financiamiento",traspasos:"Traspasos internos"};
const label=k=>labels[k] || k.replace(/([A-Z])/g," $1").replaceAll("_"," ");
function Line({name,value,status,subtotal,emphasis=false}){
 return <div className={emphasis?"er-line er-emphasis":"er-line"}><div>{name}<small>{known(value)?status:"Pendiente"}</small></div><strong>{money(value)}</strong>{!known(value)&&known(subtotal?.valor)&&<details><summary>Subtotal conocido: {money(subtotal.valor)}</summary><p>Incluye: {(subtotal.incluye||[]).join(", ")}</p><p>Falta: {(subtotal.faltan||[]).join(", ")}</p></details>}</div>;
}
export default function EstadoResultadosDetalle({tablero,mes,onMesChange,loading=false}){
 const [local,setLocal]=useState("");
 if(loading)return <p role="status">Cargando estado de resultados…</p>;
 if(tablero?.estado!=="listo")return <p role="status">{tablero?.motivo||"Información pendiente"}</p>;
 const estados=[...(tablero.estados||[])].sort((a,b)=>b.mes.localeCompare(a.mes));
 const e=estados.find(s=>s.mes===(mes||local))||estados[0];
 if(!e)return <p>No hay periodos disponibles.</p>;
 const c=e.consolidado||{},s=e.subtotalConocido||{};
 const provisional=!!e.provisional?.length||!!e.parcial||!c.completo||!!tablero.errores?.length;
 const status=({alta:"Confirmado",media:"Con reservas",baja:"Provisional"})[e.confianza] || "Pendiente";
 const isrStatus=String(c.tipoIsr||"").startsWith("ESTIMADO")?"Estimado · ISR":status;
 const interestStatus=e.bases?.intereses==="devengado_estimado"?"Estimado":e.bases?.intereses==="pagado_registrado"?"Pagado registrado":status;
 const rows=[
 ["Ingresos",c.ingresos,s.ingresos],
 ["Costo de mercancía",c.costoMercancia,s.costoMercancia],
 ["Utilidad bruta",c.utilidadBruta,s.utilidadBruta,true],
 ["Gastos de venta",c.gastosVenta,s.gastosVentaTotal],
 ["Gastos directos devengados",c.gastosDirectos?.devengado,s.gastosDirectosDevengado],
 ["Gastos generales devengados",c.gastosGenerales?.devengado],
 ["Utilidad operativa devengada",c.utilidadOperativa?.devengado,null,true],
 ["Intereses",c.intereses,null,false,interestStatus],
 ["Utilidad antes de ISR",c.utilidadAntesISR,null,true],
 ["ISR",c.isr,null,false,isrStatus],
 ["Utilidad neta",c.utilidadNeta,null,true,isrStatus]
 ];
 return <section className="er-root"><header><h1>Estado de resultados</h1><label>Mes<select value={e.mes} onChange={ev=>{setLocal(ev.target.value);onMesChange?.(ev.target.value);}}>{estados.map(x=><option key={x.mes} value={x.mes}>{x.mes}</option>)}</select></label><small>Confianza: {e.confianza||"pendiente"}</small></header>
 {provisional&&<details open className="er-warning"><summary>Resultado provisional</summary>{!!tablero.errores?.length&&<p>Algunas fuentes no pudieron consultarse.</p>}<ul>{(e.provisional||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></details>}
 <p>Importes en MXN. Base principal: devengado. La utilidad antes de ISR utiliza la base {e.bases?.utilidadOperativa||"pendiente"}.</p>
 <div>{rows.map(([name,value,subtotal,emphasis,custom])=><Line key={name} name={name} value={value} subtotal={subtotal} emphasis={emphasis} status={custom||status}/>)}</div>
 <h2>Base pagada y obligaciones</h2>
 <Line name="Gastos directos pagados" value={c.gastosDirectos?.pagado} status={status} subtotal={s.gastosDirectosPagado}/>
 <Line name="Gastos generales pagados" value={c.gastosGenerales?.pagado} status={status}/>
 <Line name="Utilidad operativa base pagada" value={c.utilidadOperativa?.pagado} status={status}/>
 <Line name="Obligaciones pendientes" value={e.obligacionesPendientes} status={status}/>
 <h2>Movimientos que no son gasto operativo</h2><p>No se restan nuevamente de la utilidad. Tampoco equivalen al saldo de caja.</p>
 {e.noSonGasto?Object.entries(e.noSonGasto).map(([k,v])=><Line key={k} name={label(k)} value={v} status={status}/>):<p>Información pendiente de Tesorería.</p>}
 <details><summary>Datos pendientes y bases de cálculo</summary><ul>{(e.faltantes||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><p>IVA:</p><ul>{Object.entries(e.bases?.iva||{}).map(([k,v])=><li key={k}>{label(k)}: {String(v)}</li>)}</ul></details>
 </section>;
}
