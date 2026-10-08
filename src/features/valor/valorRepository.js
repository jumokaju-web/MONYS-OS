import { validarIniciativa, validarResultado, leerRegistroValor } from './valorEconomico.js';
export function crearServicioValor(supabase) {
async function validarCuenta(usuario) {
 const {data:auth,error:authError}=await supabase.auth.getUser();
 if(authError || !auth?.user?.id || auth.user.id!==usuario?.auth_user_id)throw new Error('La sesión cambió. Vuelve a abrir tu cuenta.');
 const {data,error}=await supabase.from('usuarios').select('id,nombre,role,active,organization_id,business_id,branch_id').eq('auth_user_id',auth.user.id).single();
 if(error || !data || data.active!==true || data.role!=='owner')throw new Error('Este centro requiere una cuenta de dirección activa.');
 if(!data.organization_id || !data.business_id || !data.branch_id || data.organization_id!==usuario.organization_id || data.business_id!==usuario.business_id || data.branch_id!==usuario.branch_id)throw new Error('Selecciona un negocio y una sucursal válidos antes de continuar.');
 return data;
}
function aplicarAlcance(consulta,u) {return consulta.eq('organization_id',u.organization_id).eq('business_id',u.business_id).eq('branch_id',u.branch_id);}
async function cargarCentroValor(usuario) {
 const u=await validarCuenta(usuario);
 const [tareas,caja]=await Promise.all([aplicarAlcance(supabase.from('tareas_operativas').select('id,titulo,descripcion,responsable,estado,fecha,resultado,updated_at,evaluacion_estado'),u).like('titulo','[Valor]%').order('created_at',{ascending:false}).limit(200),aplicarAlcance(supabase.from('cash_movements').select('id,concept,amount,movement_type,status,occurred_at,counterparty'),u).or('concept.ilike.[MONYS LICENCIA]%,concept.ilike.[MONYS IMPLEMENTACION]%,concept.ilike.[MONYS COSTO]%').order('occurred_at',{ascending:false}).limit(500)]);
 if(tareas.error)throw new Error(`No se pudieron cargar iniciativas: ${tareas.error.message}`);
 return {iniciativas:(tareas.data || []).filter(t=>leerRegistroValor(t)),movimientos:caja.data || [],errorCaja:caja.error?.message || '',limiteIniciativas:(tareas.data || []).length>=200,limiteMovimientos:(caja.data || []).length>=500};
}
async function crearIniciativaValor(usuario,datos) {
 const u=await validarCuenta(usuario);const d=validarIniciativa(datos);
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id || '')) throw new Error('Falta identificar la iniciativa. Abre un formulario nuevo.');
 const registro={...d,tipo:'INICIATIVA_VALOR_V1',estadoMedicion:'BASE_REGISTRADA',creadaEn:new Date().toISOString(),historial:[]};
 const {data,error}=await supabase.from('tareas_operativas').insert({id:d.id,organization_id:u.organization_id,business_id:u.business_id,branch_id:u.branch_id,titulo:`[Valor] ${d.titulo}`,descripcion:d.hipotesis,area:'general',responsable:u.nombre,prioridad:'alta',fecha:d.fecha,estado:'pendiente',creada_por:u.nombre,requiere_evidencia:true,criterio_exito:`Comparar ${d.indicador==='gasto'?'gasto':'utilidad bruta'} en dos periodos de ${d.dias} días, registrar costo de la acción, referencia de evidencia y aprendizaje. Revisión de dirección antes de usar el resultado.`,instrucciones:`Línea base: $${d.base}. Fuente: ${d.fuenteBase}. Acción por revisar: ${d.hipotesis}`,resultado:JSON.stringify(registro),updated_at:new Date().toISOString()}).select().single();
 if(error?.code==='23505') { const {data:existente,error:lectura}=await aplicarAlcance(supabase.from('tareas_operativas').select('*').eq('id',d.id),u).single(); if(!lectura && leerRegistroValor(existente)) return existente; }
 if(error)throw new Error(`No se pudo guardar la iniciativa: ${error.message}`);return data;
}
async function registrarResultadoValor(usuario,tarea,datos) {
 const u=await validarCuenta(usuario);
 const {data:actual,error:lectura}=await aplicarAlcance(supabase.from('tareas_operativas').select('id,resultado,updated_at').eq('id',tarea.id),u).single();
 if(lectura || !actual)throw new Error('La iniciativa no está disponible en este negocio.');
 const base=leerRegistroValor(actual);if(!base)throw new Error('Este registro no es una iniciativa de valor.');
 if(base.estadoMedicion==='REVISADA')throw new Error('Este resultado ya fue revisado. Crea una nueva prueba para conservar el historial.');
 const resultado=validarResultado(datos,base);
 const nuevo={...base,resultado,estadoMedicion:'RESULTADO_REGISTRADO',historial:[...(base.historial || []),{accion:'RESULTADO_REGISTRADO',resultadoAnterior:base.resultado || null,resultadoNuevo:resultado,fecha:new Date().toISOString(),por:u.nombre}]};
 let consulta=aplicarAlcance(supabase.from('tareas_operativas').update({resultado:JSON.stringify(nuevo),estado:'en_proceso',updated_at:new Date().toISOString()}).eq('id',actual.id),u);
 consulta=actual.updated_at?consulta.eq('updated_at',actual.updated_at):consulta.is('updated_at',null);
 const {data,error}=await consulta.select().maybeSingle();if(error || !data)throw new Error(error?.message || 'Otro usuario cambió la iniciativa. Actualiza antes de guardar.');return data;
}
async function revisarResultadoValor(usuario,tarea) {
 const u=await validarCuenta(usuario);
 const {data:actual,error:lectura}=await aplicarAlcance(supabase.from('tareas_operativas').select('id,resultado,updated_at').eq('id',tarea.id),u).single();
 if(lectura || !actual)throw new Error('No se encontró la iniciativa en este negocio.');
 const base=leerRegistroValor(actual);if(!base || !base.resultado || base.estadoMedicion==='REVISADA')throw new Error('Primero registra el resultado y su evidencia, o actualiza si ya se revisó.');
 validarResultado(base.resultado,base);
 const nuevo={...base,estadoMedicion:'REVISADA',revisadaPor:u.nombre,revisadaEn:new Date().toISOString(),historial:[...(base.historial || []),{accion:'REVISION_HUMANA',fecha:new Date().toISOString(),por:u.nombre}]};
 let consulta=aplicarAlcance(supabase.from('tareas_operativas').update({resultado:JSON.stringify(nuevo),estado:'terminada',completada_por:u.nombre,completada_at:new Date().toISOString(),updated_at:new Date().toISOString(),requiere_revision:false}).eq('id',actual.id),u);
 consulta=actual.updated_at?consulta.eq('updated_at',actual.updated_at):consulta.is('updated_at',null);
 const {data,error}=await consulta.select().maybeSingle();if(error || !data)throw new Error(error?.message || 'El resultado cambió. Actualiza antes de revisar.');return data;
}

return {cargarCentroValor,crearIniciativaValor,registrarResultadoValor,revisarResultadoValor};
}
