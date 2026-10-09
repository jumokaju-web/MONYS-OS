import { supabase } from '../../../supabase';
import { validarEstadoBancario } from '../utils/validarEstadoBancario';
async function contexto(usuario) {
 if (!usuario?.auth_user_id || !usuario?.organization_id || !usuario?.business_id || !usuario?.branch_id || usuario.role !== 'owner') throw new Error('Se requiere una sesión de propietaria con negocio y sucursal.');
 const {data,error}=await supabase.auth.getUser();
 if(error || data?.user?.id !== usuario.auth_user_id) throw new Error('La sesión cambió. Inicia sesión de nuevo.');
 return {created_by:usuario.auth_user_id,organization_id:usuario.organization_id,business_id:usuario.business_id,branch_id:usuario.branch_id};
}
const fallar = error => { throw new Error(`No se pudo acceder al guardado bancario: ${error.message}. Conserva tu revisión descargada. La tabla y sus permisos deben estar habilitados.`); };
export async function guardarRevisionBanco(usuario,paquete) {
 validarEstadoBancario(paquete); const scope=await contexto(usuario);
 const {data,error}=await supabase.from('revisiones_bancarias').insert({...scope,paquete}).select('id,created_at').single();
 if(error)fallar(error); if(!data?.id)throw new Error('No se confirmó el guardado. Descarga tu revisión.'); return data;
}
export async function recuperarRevisionBanco(usuario) {
 const scope=await contexto(usuario);let query=supabase.from('revisiones_bancarias').select('id,created_at,paquete');
 for(const [campo,valor] of Object.entries(scope))query=query.eq(campo,valor);
 const {data,error}=await query.order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)fallar(error);if(!data)return null;validarEstadoBancario(data.paquete);return data;
}
