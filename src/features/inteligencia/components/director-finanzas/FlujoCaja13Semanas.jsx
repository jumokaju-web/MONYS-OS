import { useState } from 'react';
import { useUser } from '../../../../context/UserContext';
import { calcularFlujo13Semanas } from '../../utils/flujoCaja13Semanas';
import '../JuntaDirectiva.css';
const moneda = v => v === null ? 'Por completar' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
const vacio = () => ({ saldoInicial: '', inicio: '', semanas: Array.from({length:13}, () => ({cobros:'',pagos:''})) });
export default function FlujoCaja13Semanas({ metricas = {} }) {
  const { usuario } = useUser();
  const clave = usuario?.auth_user_id && usuario?.organization_id && usuario?.business_id ? JSON.stringify(['monys-caja13-v1', usuario.auth_user_id, usuario.organization_id, usuario.business_id, metricas.fechaInicial, metricas.fechaFinal]) : null;
  const [borradores, setBorradores] = useState({});
  const [mensaje, setMensaje] = useState('');
  let almacenado = vacio();
  try { const datos = clave && JSON.parse(window.localStorage.getItem(clave)); if (datos && Array.isArray(datos.semanas) && datos.semanas.length === 13) almacenado = datos; } catch { /* No recuperamos un borrador inválido. */ }
  const plan = borradores[clave || 'sesion'] || almacenado;
  const filas = calcularFlujo13Semanas(plan);
  const deficit = filas.find(f => f.deficit);
  const completas = filas.filter(f => f.completa).length;
  function actualizar(cambio) {
    const nuevo = {...plan,...cambio};
    setBorradores(v => ({...v,[clave || 'sesion']:nuevo}));
    try { if (!clave) throw new Error(); window.localStorage.setItem(clave,JSON.stringify(nuevo)); setMensaje('Borrador guardado en este dispositivo.'); } catch { setMensaje('El plan queda en esta sesión; no se pudo guardar en el dispositivo.'); }
  }
  function exportar() {
    const contenido = '\uFEFF' + [['Semana','Fecha inicial','Caja inicial','Cobros previstos','Pagos previstos','Caja final','Estado'],...filas.map(f => [f.semana,fechaSemana(f.semana),f.inicio ?? '',f.cobros ?? '',f.pagos ?? '',f.saldo ?? '',f.completa ? (f.deficit ? 'Déficit previsto' : 'Escenario completo') : 'Incompleto'])].map(f => f.map(v => '"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([contenido],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='MONYS-flujo-caja-13-semanas.csv';a.click();URL.revokeObjectURL(url);
  }
  function fechaSemana(n) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.inicio || '')) return '';
    const fecha = new Date(plan.inicio+'T12:00:00Z'); if (Number.isNaN(fecha.getTime())) return '';fecha.setUTCDate(fecha.getUTCDate()+(n-1)*7);return fecha.toISOString().slice(0,10);
  }
  return <section className="junta" aria-label="Flujo de caja de trece semanas"><header><div><span className="junta-label">PLANEACIÓN FINANCIERA</span><h2>Caja · próximas 13 semanas</h2><p>Escenario manual de cobros y compromisos. Separado de la utilidad SICAR.</p></div><span className="junta-pill">{completas}/13 semanas calculables</span></header><p>Incluye cobros de tienda y flotilla que realmente esperas recibir; pagos a proveedores, nómina, renta, impuestos, créditos y préstamos cuando venzan. Una venta a crédito no es un cobro hasta su fecha de pago. Captura 0 solo cuando confirmes que no habrá importe.</p><div className="junta-columns"><label>Inicio de la primera semana<input type="date" value={plan.inicio} onChange={e => actualizar({inicio:e.target.value})}/></label><label>Saldo disponible al inicio (MXN)<input type="number" min="0" step="0.01" placeholder="Saldo de caja y banco conciliado" value={plan.saldoInicial} onChange={e => actualizar({saldoInicial:e.target.value})}/></label></div><p role="status">{deficit ? `Atención: déficit previsto en semana ${deficit.semana}, ${moneda(deficit.saldo)}. Revisa compromisos antes de autorizar gasto.` : completas === 13 ? 'El escenario ingresado no presenta déficit; depende de que se cumplan los cobros previstos.' : 'Faltan importes. Las semanas incompletas no se muestran como caja disponible.'}</p><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><caption>Importes estimados por ti; no conciliados automáticamente con banco.</caption><thead><tr>{['Semana','Cobros (MXN)','Pagos (MXN)','Caja final'].map(t => <th key={t} style={{textAlign:'left',padding:10}}>{t}</th>)}</tr></thead><tbody>{filas.map((f,i) => <tr key={f.semana} style={{background:f.deficit?'#fff0ed':'transparent',borderTop:'1px solid #ead8e2'}}><td style={{padding:10,minWidth:90}}><strong>{f.semana}</strong><br/><small>{fechaSemana(f.semana)}</small></td>{['cobros','pagos'].map(campo => <td key={campo} style={{padding:6}}><input aria-label={`${campo} semana ${f.semana}`} style={{minWidth:100}} type="number" min="0" step="0.01" placeholder="Pendiente" value={plan.semanas[i][campo]} onChange={e => actualizar({semanas:plan.semanas.map((s,j) => j === i ? {...s,[campo]:e.target.value} : s)})}/></td>)}<td style={{padding:10,minWidth:130,color:f.deficit?'#a53938':'inherit'}}>{moneda(f.saldo)}</td></tr>)}</tbody></table></div><p>Se conserva por cuenta, negocio y corte en este dispositivo. No se sincroniza con otros equipos ni sustituye saldos bancarios. No extrapolamos ventas como efectivo.</p>{mensaje && <p role="status">{mensaje}</p>}<button type="button" onClick={exportar}>Descargar escenario de 13 semanas</button></section>;
}
