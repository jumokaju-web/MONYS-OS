import { useState } from 'react';
import { useUser } from '../../../../context/UserContext';
import { claveEscenarios, leerEscenarios, guardarEscenarios } from '../../utils/escenariosEquilibrio';
import { calcularEquilibrioDiario } from '../../utils/equilibrioDiario';
import PalancasEquilibrio from './PalancasEquilibrio';
import { validarMesEquilibrio } from '../../utils/palancasEquilibrio';
import { crearRespaldoEquilibrio, leerRespaldoEquilibrio } from '../../utils/respaldoEquilibrio';
const dinero=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(v);
const campos=[['gastosFijos','Gastos fijos del mes (MXN)'],['margenBruto','Margen bruto previsto (%)'],['variablePorcentaje','Otros costos variables sobre ventas (%)'],['diasAbiertos','Días que abrirás en el mes'],['deuda','Pagos de deuda del mes (MXN)'],['ventaPrevista','Venta prevista del mes (MXN)']];
export default function EquilibrioDiario({ alcance }){
 const {usuario}=useUser();
 const clave=claveEscenarios(usuario,alcance);
 const [borradores,setBorradores]=useState({});
 const [seleccion,setSeleccion]=useState(0);
 const [mensaje,setMensaje]=useState('');
 const [respaldoPendiente,setRespaldoPendiente]=useState(null);
 const [errorRespaldo,setErrorRespaldo]=useState('');
 const lectura=leerEscenarios({getItem:k=>window.localStorage.getItem(k)},clave);
 const escenarios=borradores[clave || 'sesion'] || lectura.escenarios;
 const {datos,mes}=escenarios[seleccion];
 function actualizar(cambio){
   const nuevos=escenarios.map((s,i)=>i===seleccion?{...s,...cambio}:s);
   setBorradores(v=>({...v,[clave || 'sesion']:nuevos}));
   setMensaje(guardarEscenarios({setItem:(k,v)=>window.localStorage.setItem(k,v)},clave,nuevos).mensaje);
 }
 function descargarRespaldo(){
  try { const paquete=crearRespaldoEquilibrio(usuario,alcance,escenarios); const url=URL.createObjectURL(new Blob([JSON.stringify(paquete,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download='MONYS-respaldo-equilibrio.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setErrorRespaldo(''); }
  catch(e){setErrorRespaldo(e.message);}
 }
 async function abrirRespaldo(event){
  const archivo=event.target.files?.[0];event.target.value='';if(!archivo)return;
  try {if(archivo.size>200000)throw new Error('El respaldo supera el tamaño permitido.');const nuevos=leerRespaldoEquilibrio(JSON.parse(await archivo.text()),usuario,alcance);setRespaldoPendiente({clave,escenarios:nuevos});setErrorRespaldo('');}
  catch(e){setRespaldoPendiente(null);setErrorRespaldo(e.message || 'No se pudo abrir el respaldo.');}
 }
 function restaurarRespaldo(){
  if(!respaldoPendiente || respaldoPendiente.clave!==clave)return;
  setBorradores(v=>({...v,[clave || 'sesion']:respaldoPendiente.escenarios}));setSeleccion(0);
  setMensaje(guardarEscenarios({setItem:(k,v)=>window.localStorage.setItem(k,v)},clave,respaldoPendiente.escenarios).mensaje);setRespaldoPendiente(null);
 }
 function exportar(){
  const filas=[['Escenario','Mes','Tipo',...campos.map(([,label])=>label),'Meta diaria operación','Meta diaria operación y deuda','Estado'],...escenarios.map(s=>{const x=calcularEquilibrioDiario(s.datos);const listo=x.calculable&&validarMesEquilibrio(s.mes,s.datos.diasAbiertos).valido;return [s.nombre,s.mes,'ESTIMACION',...campos.map(([c])=>s.datos[c]),listo?x.operacionDiaria:'',listo?x.cajaDiaria:'',listo?'Escenario calculable':'Incompleto o inválido'];})];
  const csv='\uFEFF'+filas.map(f=>f.map(v=>'"'+String(/^[=+@-]/.test(String(v)) ? "'"+v : v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='MONYS-escenarios-equilibrio.csv';a.click();URL.revokeObjectURL(url);
 }

 const r=calcularEquilibrioDiario(datos);
 const periodo=validarMesEquilibrio(mes,datos.diasAbiertos);
 const listo=Boolean(periodo.valido && r.calculable);
 const metaDiaria=<div className="junta-asientos equilibrio-metas"><article><span className="junta-label">PUNTO DE EQUILIBRIO DIARIO</span><h3>{listo?dinero(r.operacionDiaria):'Por completar'}</h3><p>Venta necesaria cada día que abres para cubrir la operación.</p></article><article><span className="junta-label">META DIARIA CON DEUDAS</span><h3>{listo?dinero(r.cajaDiaria):'Por completar'}</h3><p>Venta necesaria cada día para cubrir operación y pagos de deuda.</p></article></div>;
 return <section id="equilibrio-diario" className="junta" aria-label="Simulador de equilibrio diario"><header><div><span className="junta-label">ESTIMACIÓN · ESCENARIO MANUAL</span><h2>Tu punto de equilibrio diario</h2><p>La meta es por día abierto. Los gastos del mes se distribuyen entre los días que trabajarás.</p></div></header>{metaDiaria}<p><b>Periodo de la meta:</b> {mes || 'elige el mes'} · {datos.diasAbiertos || 'completa los'} días abiertos · {alcance || 'alcance pendiente'}.</p><nav aria-label="Escenarios financieros">{escenarios.map((s,i)=><button type="button" key={s.nombre} aria-pressed={seleccion===i} onClick={()=>setSeleccion(i)}>{s.nombre}</button>)}</nav><p>Captura tus supuestos para cada escenario. Conservador y Mejora no son pronósticos automáticos. Alcance: {alcance || "por seleccionar"}.</p><label>Mes del escenario<input type="month" value={mes} onChange={e=>actualizar({mes:e.target.value})}/></label><p>Gastos fijos: renta, nómina fija y demás operación. El margen bruto ya descuenta el costo del producto. En costos variables añade comisiones, cobro con tarjeta y otros porcentajes que aún no estén descontados. Deuda: principal e intereses; exclúyelos de gastos fijos para no contarlos dos veces.</p><div className="junta-columns">{campos.map(([c,label])=><label key={c}>{label}<input type="number" min="0" max={c==='diasAbiertos'?31:c.includes('Porcentaje')||c==='margenBruto'?100:undefined} step={c==='diasAbiertos'?1:0.01} value={datos[c]} placeholder="Por completar" onChange={e=>actualizar({datos:{...datos,[c]:e.target.value}})}/></label>)}</div>{!mes?<p role="status">Selecciona el mes para calcular el escenario.</p>:!periodo.valido?<p role="status">{periodo.motivo}</p>:!r.calculable?<p role="status">{r.motivo}</p>:<><p><b>Venta prevista por día:</b> {dinero(r.ventaPrevistaDiaria)}. <b>Venta adicional necesaria por día:</b> {dinero(r.brechaCajaDiaria)} para cubrir operación y deuda.</p><p>Margen de contribución estimado: {(r.contribucion*100).toFixed(1)}%. Faltante de venta diaria prevista: {dinero(r.brechaOperacionDiaria)} para operación y {dinero(r.brechaCajaDiaria)} incluyendo deuda.</p><p role="status">{r.brechaCaja>0?'El escenario no alcanza a cubrir operación y deuda. Revisa margen, gastos y compromisos antes de aumentar inversión.':'La venta prevista cubriría estos compromisos si se cumple el margen y se cobran las ventas.'}</p><details><summary>Cómo se calcula y totales del mes</summary><p>Venta necesaria en todo el mes: {dinero(r.operacion)} para operación y {dinero(r.caja)} con deuda. Se divide entre {datos.diasAbiertos} días abiertos para obtener tus metas diarias.</p><p>Ventas necesarias = compromisos ÷ margen de contribución. Meta diaria = ventas necesarias ÷ días abiertos. El pago de principal afecta caja; no es gasto contable. No incluye desfases de cobro, compras de inventario, impuestos adicionales, inversión ni saldos iniciales: revísalos en el flujo de 13 semanas. No representa utilidad neta ni efectivo disponible.</p></details></>}<PalancasEquilibrio datos={datos} listo={listo} /><h3>Comparar antes de decidir</h3><div style={{overflowX:'auto'}}><table style={{width:'100%'}}><caption>Escenarios manuales; compara únicamente el mismo mes y alcance.</caption><thead><tr><th>Escenario</th><th>Mes</th><th>Operación / día</th><th>Con deuda / día</th><th>Faltante de venta / día con deuda</th></tr></thead><tbody>{escenarios.map(s=>{const x=calcularEquilibrioDiario(s.datos);const listo=x.calculable && validarMesEquilibrio(s.mes,s.datos.diasAbiertos).valido;return <tr key={s.nombre}><th>{s.nombre}</th><td>{s.mes || 'Pendiente'}</td><td>{listo?dinero(x.operacionDiaria):'Por completar'}</td><td>{listo?dinero(x.cajaDiaria):'Por completar'}</td><td>{listo?dinero(x.brechaCajaDiaria):'Por completar'}</td></tr>;})}</tbody></table></div><p role="status">{mensaje || lectura.mensaje}</p><section className="equilibrio-respaldo"><h3>Conserva tus metas y continúa en otro equipo</h3><p>Descarga un respaldo y ábrelo con el mismo usuario, negocio y alcance. Abrirlo permite revisar los tres escenarios antes de reemplazar tus borradores de este dispositivo.</p><div className="equilibrio-acciones"><button type="button" onClick={descargarRespaldo}>Descargar respaldo para otro equipo</button><label>Abrir respaldo de metas<input type="file" accept=".json,application/json" onChange={abrirRespaldo}/></label><button type="button" onClick={exportar}>Descargar comparación en CSV</button></div>{respaldoPendiente?.clave===clave && <div><p>Se restaurarán estos escenarios:</p><ul>{respaldoPendiente.escenarios.map(s=><li key={s.nombre}>{s.nombre} · {s.mes || 'Mes pendiente'}</li>)}</ul><button type="button" onClick={restaurarRespaldo}>Restaurar estos tres escenarios</button><button type="button" onClick={()=>setRespaldoPendiente(null)}>Cancelar</button></div>}{errorRespaldo && <p role="alert">{errorRespaldo}</p>}</section><p>Se guardan por cuenta, negocio y alcance en este dispositivo. No se sincronizan entre equipos. Todos los importes siguen siendo estimaciones; revisa cobros y vencimientos en el flujo de 13 semanas antes de autorizar inversión.</p></section>;
}
