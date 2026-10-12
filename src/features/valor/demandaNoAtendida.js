export const MOTIVOS_DEMANDA = {agotado:'Sin existencia',no_manejamos:'Producto no manejado',variante:'Falta tono o variante',precio:'Objeción de precio',otro:'Otro motivo'};
function fechaValida(valor) {const fecha=new Date(`${valor}T12:00:00`);return Number.isNaN(fecha.getTime())?null:fecha;}
export function recomendarMomentoDemanda({solicitudes=0,comprasNoRealizadas=0,unidadesNoRealizadas=0,fechas=[]}={}) {
 const fechasValidas=fechas.map(fechaValida).filter(Boolean).sort((a,b)=>b-a);const ultimaFecha=fechasValidas[0]||null;const primeraFecha=fechasValidas[fechasValidas.length-1]||null;
 const diasEntre=ultimaFecha&&primeraFecha?Math.round((ultimaFecha-primeraFecha)/86400000):null;
 if(comprasNoRealizadas>=3 || unidadesNoRealizadas>=5 || (comprasNoRealizadas>=2 && diasEntre!==null && diasEntre<=7))return {momento:'HOY',nivel:'alta',accion:'Revisar existencia en ambas sucursales, margen y caja hoy; trasladar antes de comprar.'};
 if(comprasNoRealizadas>=1 || solicitudes>=2)return {momento:'ESTA SEMANA',nivel:'media',accion:'Validar stock y proveedor esta semana; todavía no es una orden automática.'};
 return {momento:'OBSERVAR',nivel:'baja',accion:'Seguir registrando solicitudes antes de ampliar el surtido.'};
}
export function crearLineaDemanda({producto,unidades,motivo,compraNoRealizada,precio}) {
 const nombre=String(producto || '').replace(/[|\r\n]/g,' ').replace(/\s+/g,' ').trim();
 if(!nombre || nombre.length>180)throw new Error('Indica el producto, marca y variante en máximo 180 caracteres.');
 const cantidad=Number(unidades);if(!Number.isInteger(cantidad) || cantidad<1 || cantidad>10000)throw new Error('Indica unidades solicitadas entre 1 y 10000.');
 if(!MOTIVOS_DEMANDA[motivo] || !['si','no','pendiente'].includes(compraNoRealizada))throw new Error('Selecciona motivo y confirma si no se realizó la compra.');
 const importe=String(precio ?? '').trim()===''?null:Number(precio);if(importe!==null && (!Number.isFinite(importe) || importe<0))throw new Error('El precio debe ser válido o quedar pendiente.');
 return `Solicitud: ${nombre} | Unidades: ${cantidad} | Motivo: ${motivo} | Compra no realizada: ${compraNoRealizada} | Precio unitario: ${importe===null?'pendiente':importe}`;
}
export function leerDemandaCierres(cierres=[]) {
 const solicitudes=[],anotaciones=[];const vistos=new Set();
 for(const cierre of cierres) {
  if(!cierre?.id || vistos.has(cierre.id))continue;vistos.add(cierre.id);
  String(cierre.productos_solicitados || '').split(/\r?\n/).forEach((texto,i)=>{
   const linea=texto.trim();if(!linea)return;
   const m=/^Solicitud: (.+?) \| Unidades: (\d+) \| Motivo: (agotado|no_manejamos|variante|precio|otro) \| Compra no realizada: (si|no|pendiente) \| Precio unitario: (pendiente|\d+(?:\.\d+)?)$/.exec(linea);
   if(!m || Number(m[2])<1 || Number(m[2])>10000 || (m[5]!=='pendiente' && !Number.isFinite(Number(m[5])))){anotaciones.push({cierreId:cierre.id,fecha:cierre.fecha,texto:linea});return;}
   solicitudes.push({id:`${cierre.id}-${i}`,producto:m[1],unidades:Number(m[2]),motivo:m[3],compraNoRealizada:m[4],precio:m[5]==='pendiente'?null:Number(m[5]),fecha:cierre.fecha,responsable:cierre.responsable,cierreId:cierre.id});
  });
 }
 const grupos=new Map();
 for(const s of solicitudes) {const clave=s.producto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()+'|'+s.motivo;const g=grupos.get(clave)||{producto:s.producto,motivo:s.motivo,unidades:0,unidadesNoRealizadas:0,solicitudes:0,comprasNoRealizadas:0,valorPotencial:0,preciosPendientes:0,fechas:[],fuentes:[]};g.unidades+=s.unidades;g.solicitudes++;if(s.fecha)g.fechas.push(s.fecha);if(s.compraNoRealizada==='si'){g.comprasNoRealizadas++;g.unidadesNoRealizadas+=s.unidades;if(s.precio===null)g.preciosPendientes++;else g.valorPotencial+=s.precio*s.unidades;}g.fuentes.push({fecha:s.fecha,cierreId:s.cierreId,responsable:s.responsable});grupos.set(clave,g);}
 const prioridades=[...grupos.values()].map(g=>({...g,...recomendarMomentoDemanda(g)})).sort((a,b)=>({alta:0,media:1,baja:2}[a.nivel]-({alta:0,media:1,baja:2}[b.nivel]) || b.comprasNoRealizadas-a.comprasNoRealizadas || b.unidades-a.unidades));
 return {solicitudes,anotaciones,prioridades,totalUnidades:solicitudes.reduce((s,r)=>s+r.unidades,0),comprasNoRealizadas:solicitudes.filter(s=>s.compraNoRealizada==='si').length};
}
