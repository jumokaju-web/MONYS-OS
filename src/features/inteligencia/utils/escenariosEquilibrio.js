export const nombresEscenarios = ['Base', 'Conservador', 'Mejora'];
export const camposEquilibrio = ['gastosFijos','margenBruto','variablePorcentaje','diasAbiertos','deuda','ventaPrevista'];
export function escenariosVacios() {return nombresEscenarios.map(nombre=>({nombre,mes:'',datos:Object.fromEntries(camposEquilibrio.map(c=>[c,'']))}));}
export function claveEscenarios(usuario, alcance) {
 if(!usuario?.auth_user_id || !usuario?.organization_id || !usuario?.business_id || !alcance) return null;
 return JSON.stringify(['monys-equilibrio-v1',usuario.auth_user_id,usuario.organization_id,usuario.business_id,alcance]);
}
export function leerEscenarios(storage,clave) {
 if(!clave)return {escenarios:escenariosVacios(),mensaje:'Sin alcance completo: escenario solo en sesión.'};
 try {const raw=storage.getItem(clave);if(!raw)return {escenarios:escenariosVacios(),mensaje:''};const d=JSON.parse(raw);
 if(d.version!==1 || !Array.isArray(d.escenarios)||d.escenarios.length!==3)throw new Error();
 const escenarios=d.escenarios.map((s,i)=>{if(typeof s.mes!=='string'||!s.datos||camposEquilibrio.some(c=>typeof s.datos[c]!=='string'))throw new Error();return {nombre:nombresEscenarios[i],mes:s.mes,datos:Object.fromEntries(camposEquilibrio.map(c=>[c,s.datos[c]]))};});
 return {escenarios,mensaje:'Borradores recuperados de este dispositivo.'};
 }catch{return {escenarios:escenariosVacios(),mensaje:'No se pudo recuperar el borrador. No se muestran datos guardados como válidos.'};}
}
export function guardarEscenarios(storage,clave,escenarios) {
 if(!clave)return {guardado:false,mensaje:'Sin alcance completo: los cambios quedan solo en sesión.'};
 try {storage.setItem(clave,JSON.stringify({version:1,escenarios}));return {guardado:true,mensaje:'Borradores guardados en este dispositivo.'};}catch{return {guardado:false,mensaje:'No se pudo guardar. Los cambios quedan en esta sesión.'};}
}
