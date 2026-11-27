const DIA = 86400000;
export function fechaVentaSicar(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 20000 && valor < 100000)
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * DIA).toISOString().slice(0, 10);
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if (/^\d+(\.\d+)?$/.test(texto)) return fechaVentaSicar(Number(texto));
  const mx = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s.*)?$/);
  const iso = mx ? `${mx[3]}-${mx[2]}-${mx[1]}` : texto.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/)?.[1];
  if (!iso) return null;
  const fecha = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === iso ? iso : null;
}
function numero(valor) {
  if (!['string', 'number'].includes(typeof valor) || String(valor).trim() === '') return null;
  const n=Number(valor); return Number.isFinite(n) ? n : null;
}
const mover=(fecha,n)=>new Date(new Date(`${fecha}T12:00:00Z`).getTime()+n*DIA).toISOString().slice(0,10);
const redondear=n=>Math.round((n+Number.EPSILON)*100)/100;
function resumirPaquete({ importacion, detalles = [] }) {
  const inicio=fechaVentaSicar(detalles[0]?.datos_originales?.periodoInicio);
  const fin=fechaVentaSicar(detalles[0]?.datos_originales?.periodoFin);
  if (!inicio || !fin || inicio>fin) return null;
  const dias=Math.round((new Date(`${fin}T12:00:00Z`)-new Date(`${inicio}T12:00:00Z`))/DIA)+1;
  if (dias>31) return null;
  const filas=new Map(); let invalidas=0;
  for (const fila of detalles) {
    const d=fila.datos_originales || {};
    const fecha=fechaVentaSicar(d.fecha);
    const venta=numero(d.ventaTotal ?? d.importe);
    if (!fecha || fecha<inicio || fecha>fin || venta===null || d.periodoInicio!==inicio || d.periodoFin!==fin) { invalidas++; continue; }
    if (!filas.has(fecha)) filas.set(fecha,{fecha,ventas:0,utilidadBruta:0,utilidadCompleta:true,operaciones:0});
    const dia=filas.get(fecha), utilidad=numero(d.utilidad);
    dia.ventas+=venta; dia.operaciones++;
    if (utilidad===null) dia.utilidadCompleta=false; else dia.utilidadBruta+=utilidad;
  }
  return { importacion, inicio, fin, dias, invalidas, filas };
}
export function construirVentasDiariasSicar(paquetes = [], nombres = {}) {
  const porSucursal=new Map();
  for (const paquete of paquetes) {
    if (!paquete?.importacion?.id || !paquete.importacion.branch_id) continue;
    const periodo=resumirPaquete(paquete); if (!periodo) continue;
    const id=paquete.importacion.branch_id;
    if (!porSucursal.has(id)) porSucursal.set(id,[]);
    porSucursal.get(id).push(periodo);
  }
  return [...porSucursal].map(([branchId,periodos])=>{
    periodos.sort((a,b)=>b.fin.localeCompare(a.fin)||b.inicio.localeCompare(a.inicio)||String(b.importacion.created_at||'').localeCompare(String(a.importacion.created_at||'')));
    const actual=periodos[0];
    const anterior=actual.dias===7 ? periodos.find(p=>p.inicio===mover(actual.inicio,-7)&&p.fin===mover(actual.fin,-7)) : null;
    const filas=Array.from({length:actual.dias},(_,i)=>{
      const fecha=mover(actual.inicio,i), d=actual.filas.get(fecha), a=anterior?.filas.get(mover(fecha,-7));
      const ventas=d && !actual.invalidas ? redondear(d.ventas) : null;
      const previa=a && !anterior.invalidas ? redondear(a.ventas) : null;
      return {fecha,ventas,utilidadBruta:d?.utilidadCompleta && !actual.invalidas ? redondear(d.utilidadBruta):null,
        operaciones:d?.operaciones ?? null,anterior:previa,
        variacion:ventas!==null && previa!==null && previa>0 ? (ventas-previa)/previa*100 : null};
    });
    const validas=filas.filter(f=>f.ventas!==null);
    const completa=validas.length===actual.dias && actual.invalidas===0;
    const maximo=completa?Math.max(...validas.map(f=>f.ventas)):null;
    const minimo=completa?Math.min(...validas.map(f=>f.ventas)):null;
    return {branchId,nombre:nombres[branchId]||'Sucursal',inicio:actual.inicio,fin:actual.fin,filas,completa,invalidas:actual.invalidas,
      fuertes:maximo===null?[]:validas.filter(f=>f.ventas===maximo),
      debiles:minimo===null?[]:validas.filter(f=>f.ventas===minimo),
      fuente:actual.importacion.archivo_original||'Utilidad de ventas',
      comparacionDisponible:Boolean(anterior && !anterior.invalidas)};
  });
}
