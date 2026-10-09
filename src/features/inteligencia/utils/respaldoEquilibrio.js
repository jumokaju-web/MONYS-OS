import { camposEquilibrio, nombresEscenarios } from './escenariosEquilibrio.js';
const contexto = (usuario, alcance) => {
 if (!usuario?.auth_user_id || !usuario?.organization_id || !usuario?.business_id || !alcance) throw new Error('Falta usuario, negocio o alcance para el respaldo.');
 return {usuario:usuario.auth_user_id,organizacion:usuario.organization_id,negocio:usuario.business_id,alcance};
};
function normalizar(escenarios) {
 if (!Array.isArray(escenarios) || escenarios.length !== 3) throw new Error('El respaldo debe contener los tres escenarios.');
 return escenarios.map((s,i)=>{
  if (s?.nombre!==nombresEscenarios[i] || typeof s.mes!=='string' || (s.mes!=='' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(s.mes)) || !s.datos) throw new Error('Escenario o mes inválido.');
  for (const c of camposEquilibrio) {
   const v=s.datos[c];
   if (typeof v!=='string' || v.length>40 || (v!=='' && (!/^\d+(\.\d+)?$/.test(v) || !Number.isFinite(Number(v))))) throw new Error('Dato inválido en el respaldo.');
  }
  return {nombre:nombresEscenarios[i],mes:s.mes,datos:Object.fromEntries(camposEquilibrio.map(c=>[c,s.datos[c]]))};
 });
}
export function crearRespaldoEquilibrio(usuario,alcance,escenarios) {return {tipo:'MONYS-ESCENARIOS-EQUILIBRIO',version:1,contexto:contexto(usuario,alcance),escenarios:normalizar(escenarios)};}
export function leerRespaldoEquilibrio(paquete,usuario,alcance) {
 if (paquete?.tipo!=='MONYS-ESCENARIOS-EQUILIBRIO' || paquete.version!==1) throw new Error('Este archivo no es un respaldo de escenarios MONYS.');
 const actual=contexto(usuario,alcance);
 if (Object.entries(actual).some(([c,v])=>paquete.contexto?.[c]!==v)) throw new Error('El respaldo pertenece a otro usuario, negocio o alcance. Selecciona el contexto correcto antes de abrirlo.');
 return normalizar(paquete.escenarios);
}
