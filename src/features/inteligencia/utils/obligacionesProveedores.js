export function resumirObligacionesProveedores(reporte={},hoy){
 if(!reporte.importacion)return {disponible:false,filas:[],motivo:'Falta un reporte de créditos de proveedores para esta sucursal.'};
 const seen=new Set();const filas=(reporte.creditos || []).filter(c=>!c.id||(!seen.has(c.id)&&seen.add(c.id))).map(c=>{
 const saldo=c.saldo==null||String(c.saldo).trim()===''?null:Number(c.saldo);
 const importe=Number.isFinite(saldo)&&saldo>=0?saldo:null;
 const raw=String(c.fecha_vencimiento || '').slice(0,10);const d=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(raw+'T12:00:00Z'):null;
 const fecha=d&&!Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===raw?raw:null;
 const dias=fecha?Math.round((new Date(fecha+'T12:00:00Z')-new Date(hoy+'T12:00:00Z'))/86400000):null;
 const estado=importe===0?'Sin saldo reportado':importe===null?'Saldo por confirmar':fecha===null?'Fecha por confirmar':dias<0?'Vencido según reporte':dias===0?'Vence hoy':dias<=7?'Próximos 7 días':'Posterior';
 return {...c,importe,fecha,dias,estado};
 }).sort((a,b)=>String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')));
 return {disponible:true,filas,saldoReportado:filas.reduce((s,c)=>s+(c.importe ?? 0),0),saldosPendientes:filas.filter(c=>c.importe===null).length,sinFecha:filas.filter(c=>c.importe>0&&!c.fecha).length,vencido:filas.filter(c=>c.importe>0&&c.dias!==null&&c.dias<0).reduce((s,c)=>s+c.importe,0),proximos7:filas.filter(c=>c.importe>0&&c.dias!==null&&c.dias>=0&&c.dias<=7).reduce((s,c)=>s+c.importe,0)};
}
