import { validarCarga } from './validarCarga.js';
export async function identidadCarga({branchId,tipoReporte,datosNormalizados}) {
 const texto=JSON.stringify([branchId,tipoReporte,datosNormalizados]);
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto)));
 hash[6]=(hash[6]&15)|80;hash[8]=(hash[8]&63)|128;
 const h=Array.from(hash.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function guardarCargaConfirmada(carga,operaciones){
 validarCarga(carga);
 const id=await identidadCarga(carga);
 const existente=await operaciones.buscar(id);
 if(existente)throw new Error(`Esta información ya tiene una carga ${id} (${existente.estado || 'por revisar'}). Revisa el historial antes de volver a importar; no se duplicaron registros.`);
 let etapa='crear registro pendiente';
 try {
 const registro=await operaciones.crear({...carga,id,estado:'pendiente'});
 if(!registro?.id || registro.id!==id)throw new Error('No se confirmó el registro inicial.');
 etapa='guardar detalles';await operaciones.detalles(registro);
 etapa='guardar datos de destino';await operaciones.destino(registro);
 etapa='confirmar finalización';const final=await operaciones.confirmar(registro);
 if(final?.id!==id || final.estado!=='procesado')throw new Error('No se confirmó el estado final.');
 return final;
 }catch(e){throw new Error(`Carga ${id}: falló al ${etapa}. ${e.message} Puede haber datos parciales; no reimportes automáticamente. Revisa el historial.`,{cause:e});}
}
