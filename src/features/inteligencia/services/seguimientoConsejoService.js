import { fechaConsejoValida, tituloPropuestaConsejo } from '../utils/seguimientoConsejo';
import { supabase } from '../../../supabase';
import { crearTareaOperativa } from './tareasOperativasService';
function validarAlcance(usuario) {
 if (!usuario?.organization_id || !usuario?.business_id || !usuario?.branch_id || !usuario?.auth_user_id || !usuario?.nombre) throw new Error('Selecciona una sucursal y una cuenta completa para trabajar el seguimiento.');
}
export async function obtenerSeguimientoConsejo(usuario) {
 validarAlcance(usuario);
 const {data,error}=await supabase.from('tareas_operativas').select('id,titulo,descripcion,responsable,estado,fecha,resultado,evaluacion_estado,requiere_revision,completada_at').eq('organization_id',usuario.organization_id).eq('business_id',usuario.business_id).eq('branch_id',usuario.branch_id).like('titulo','[Consejo]%').order('created_at',{ascending:false}).limit(30);
 if(error)throw new Error(error.message);return data || [];
}
export async function tomarPropuestaConsejo({usuario,propuesta,fecha,periodo}) {
 validarAlcance(usuario);
 if (!propuesta?.titulo || !propuesta?.descripcion || !fechaConsejoValida(fecha)) throw new Error('Completa la propuesta y su fecha de revisión.');
 const {data,error}=await supabase.auth.getUser();
 if(error || data?.user?.id !== usuario.auth_user_id) throw new Error('La sesión cambió. Vuelve a cargar tu cuenta antes de crear la tarea.');
 const titulo = tituloPropuestaConsejo(propuesta, periodo);
 const {data: existente,error: errorConsulta}=await supabase.from('tareas_operativas').select('id,titulo,estado,fecha,responsable').eq('organization_id',usuario.organization_id).eq('business_id',usuario.business_id).eq('branch_id',usuario.branch_id).eq('titulo',titulo).order('created_at',{ascending:false}).limit(1);
 if(errorConsulta) throw new Error('No se pudo comprobar el seguimiento existente. No se creó otra tarea.');
 if(existente?.length) return {...existente[0], existente: true};
 return crearTareaOperativa({organizationId:usuario.organization_id,businessId:usuario.business_id,branchId:usuario.branch_id,titulo,descripcion:propuesta.descripcion,area:'general',responsable:usuario.nombre,prioridad:'alta',fecha,creadaPor:usuario.nombre,requiereEvidencia:true,criterioExito:'Adjuntar evidencia de la revisión, registrar resultado y siguiente acción. Crear esta tarea no autoriza gasto ni ejecución de la propuesta.',instrucciones:`Fuente: ${propuesta.fuente}. Cruce: ${propuesta.cruce}`});
}
