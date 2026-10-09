import { useState } from 'react';
import { prepararRevisionFinanciera } from '../utils/conciliacionMovimientos';
import './RevisionFinanciera.css';
export default function RevisionFinanciera({ movimientos = [], formatoDinero }) {
 const [filtro,setFiltro]=useState('Todos');const [verTodo,setVerTodo]=useState(false);
 const revision=prepararRevisionFinanciera(movimientos);
 const motivos=[...new Set(revision.map(i=>i.motivo))];
 const filtrados=revision.filter(i=>filtro==='Todos'||i.motivo===filtro);
 const visibles=verTodo?filtrados:filtrados.slice(0,5);
 const dinero=formatoDinero||((n)=>Number(n).toLocaleString('es-MX',{style:'currency',currency:'MXN'}));
 return <section className="revision-dinero"><header><div><span>REVISIÓN DE MOVIMIENTOS</span><h2>Explica para qué se usó el dinero</h2><p>{revision.length} registros requieren comprobar su tratamiento.</p></div><button onClick={()=>document.getElementById('historial-tesoreria')?.scrollIntoView({behavior:'smooth'})}>Abrir historial →</button></header><div className="revision-filtros">{['Todos',...motivos].map(m=><button key={m} aria-pressed={filtro===m} onClick={()=>{setFiltro(m);setVerTodo(false);}}>{m} <small>{m==='Todos'?revision.length:revision.filter(i=>i.motivo===m).length}</small></button>)}</div><div className="revision-registros">{visibles.map(({movimiento:m,motivo,accion},i)=>{
 const bruto=m.monto??m.amount;const monto=bruto===null||bruto===undefined||bruto===''?NaN:Number(bruto);
 const fecha=String(m.fecha??m.occurred_at??'').split(',')[0];
 return <article key={m.id??i}><div className="revision-registro-main"><div><small>{fecha||'Fecha pendiente'} · {m.tipo??m.movement_type??'Tipo pendiente'}</small><h3>{m.concepto??m.concept??'Sin concepto'}</h3><span>{motivo}</span></div><strong>{Number.isFinite(monto)?dinero(monto):'Importe pendiente'}</strong></div><details><summary>Qué falta comprobar</summary><p>{accion}</p><small>Estado del registro: {m.estado??m.status??'Pendiente'}. Esta revisión no cambia su clasificación.</small></details></article>;
 })}</div>{!filtrados.length&&<p>No hay registros de este tipo en las fuentes cargadas.</p>}{filtrados.length>5&&<button className="revision-ver" onClick={()=>setVerTodo(v=>!v)}>{verTodo?'Mostrar cinco registros':`Ver los ${filtrados.length} registros`}</button>}<details className="revision-alcance"><summary>Cómo se usan estos datos</summary><p>Un mensaje, un comprobante y un descuento pueden corresponder al mismo pago. Comprueba sus vínculos antes de añadir otra salida. Esta vista usa los movimientos registrados; no calcula saldo de préstamos ni confirma que el cierre esté completo.</p></details></section>;
}
