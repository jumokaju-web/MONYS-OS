import { useCallback, useEffect, useMemo, useState } from 'react';
import { cruzarBancoCaja, resumirCruceBancoCaja } from '../utils/cruceBancoCaja';
import { anularConciliacionBancaria, guardarConciliacionBancaria, obtenerConciliacionesBancarias } from '../services/conciliacionBancariaService';

const dinero = n => Number(n).toLocaleString('es-MX',{style:'currency',currency:'MXN'});

export default function CruceBancoCaja({ paquete, movimientos = [], revisionId }) {
 const [conciliaciones,setConciliaciones]=useState([]);
 const [cargando,setCargando]=useState(false);
 const [procesando,setProcesando]=useState('');
 const [error,setError]=useState('');
 const cargar=useCallback(async()=>{
  if(!revisionId){setConciliaciones([]);return;}
  try{setCargando(true);setError('');setConciliaciones(await obtenerConciliacionesBancarias(revisionId));}
  catch(e){setError(e.message||'No fue posible consultar la conciliación bancaria.');}
  finally{setCargando(false);}
 },[revisionId]);
 useEffect(()=>{cargar();},[cargar]);
 const cruces=useMemo(()=>cruzarBancoCaja(paquete.movimientos,movimientos,conciliaciones),[paquete,movimientos,conciliaciones]);
 const resumen=useMemo(()=>resumirCruceBancoCaja(paquete.movimientos,movimientos,conciliaciones),[paquete,movimientos,conciliaciones]);
 const anuladas=conciliaciones.filter(item=>item.estado==='ANULADA');

 const confirmar=async(banco,movimiento)=>{
  if(!revisionId){setError('Primero guarda esta versión bancaria en MONYS.');return;}
  const concepto=movimiento.concepto??movimiento.concept??'Sin concepto';
  if(!window.confirm(`Confirma que el movimiento bancario de ${dinero(Number(banco.cargo)+Number(banco.abono))} corresponde al registro “${concepto}” de Tesorería. No se creará otro ingreso ni gasto.`))return;
  try{setProcesando(`guardar:${banco.id}`);setError('');await guardarConciliacionBancaria({revisionBancariaId:revisionId,banco,movimiento});await cargar();}
  catch(e){setError(e.message||'No fue posible confirmar el vínculo.');}
  finally{setProcesando('');}
 };
 const anular=async(conciliacion)=>{
  const motivo=window.prompt('Escribe por qué se anula este vínculo. El registro se conservará en el historial.');
  if(!String(motivo||'').trim())return;
  if(!window.confirm('Confirma la anulación del vínculo banco–Tesorería.'))return;
  try{setProcesando(`anular:${conciliacion.id}`);setError('');await anularConciliacionBancaria({conciliacionId:conciliacion.id,motivo});await cargar();}
  catch(e){setError(e.message||'No fue posible anular el vínculo.');}
  finally{setProcesando('');}
 };

 return <section className="banco-diagnostico"><h3>Banco frente a movimientos registrados</h3>
  <p>{movimientos.length ? `${resumen.conciliados} conciliados · ${resumen.candidatos} coincidencias únicas · ${resumen.ambiguos} con varias opciones · ${resumen.sinCoincidencia} sin coincidencia exacta.` : 'No hay movimientos de caja registrados disponibles para comparar con este paquete.'}</p>
  {!revisionId&&<p className="banco-aviso">Guarda primero esta versión en MONYS para poder confirmar vínculos. Clasificar el banco y conciliar con Tesorería son pasos separados.</p>}
  <p className="banco-aviso">Confirmar un vínculo no agrega ni elimina movimientos, no duplica ventas y no recalcula utilidad. Solo deja evidencia de qué registro de Tesorería corresponde al banco.</p>
  {cargando&&<p role="status">Consultando vínculos guardados…</p>}{error&&<p role="alert" className="banco-error">{error}</p>}
  {cruces.slice(0,30).map(({banco,candidatos,conciliacion})=><details key={banco.id} open={Boolean(conciliacion)}><summary>{banco.fecha_operacion} · Cuenta ·{banco.cuenta} · {dinero(Number(banco.cargo)+Number(banco.abono))} · {conciliacion?'CONCILIADO':`${candidatos.length} coincidencia(s)`}</summary><p><b>Banco:</b> {banco.descripcion} · {banco.referencia_visible}</p>
   {conciliacion?<div><p><b>Vinculado con Tesorería:</b> {conciliacion.snapshot?.movimiento?.concepto??conciliacion.snapshot?.movimiento?.concept??conciliacion.cash_movement_id}</p><small>Confirmado el {new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(conciliacion.registrado_en))}.</small><br/><button disabled={procesando===`anular:${conciliacion.id}`} onClick={()=>anular(conciliacion)}>{procesando===`anular:${conciliacion.id}`?'Anulando…':'Anular y corregir vínculo'}</button></div>
   :candidatos.map((m,i)=><article key={m.id||i} style={{borderTop:'1px solid #ead8e2',padding:'8px 0'}}><p><b>Registro MONYS:</b> {m.concepto??m.concept??'Sin concepto'} · {String(m.fecha??m.occurred_at??'').slice(0,10)} · {m.estado??m.status??'Sin estado'}</p><button disabled={!revisionId||procesando===`guardar:${banco.id}`} onClick={()=>confirmar(banco,m)}>{procesando===`guardar:${banco.id}`?'Guardando…':'Confirmar esta coincidencia'}</button></article>)}
  </details>)}
  {cruces.length>30&&<p>Se muestran los primeros 30 cruces. Usa periodos más pequeños para completar la revisión.</p>}
  {anuladas.length>0&&<details><summary>Historial de vínculos anulados · {anuladas.length}</summary>{anuladas.map(item=><p key={item.id}>{item.fecha_banco} · Cuenta ·{item.cuenta} · {dinero(item.monto)} · {item.motivo_anulacion}</p>)}</details>}
 </section>;
}
