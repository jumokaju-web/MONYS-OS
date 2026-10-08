export function saldoProveedor(valor){
 if(valor==null || String(valor).trim()==='')return null;
 const n=Number(String(valor).replace(/[$,\s]/g,''));return Number.isFinite(n)?n:null;
}
export function fechaProveedor(valor){
 let fecha=null;
 if(typeof valor==='number' && Number.isInteger(valor) && valor>60 && valor<100000) fecha=new Date(Date.UTC(1899,11,30)+valor*86400000).toISOString().slice(0,10);
 else {const v=String(valor ?? '').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(v))fecha=v;else {const m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)fecha=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}}
 if(!fecha)return null;const d=new Date(fecha+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===fecha?fecha:null;
}
