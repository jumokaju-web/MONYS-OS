import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToString} from 'react-dom/server';
test('registro del Consejo conserva resultado y pide siguiente acción sin aprobar automáticamente',async()=>{
 process.env.VITE_SUPABASE_URL='https://example.supabase.co';process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-only-placeholder';
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});
 try{
 const {default:Resultado}=await server.ssrLoadModule('/src/features/inteligencia/components/ResultadoConsejo.jsx');
 const props={tarea:{id:'a',estado:'pendiente',resultado:JSON.stringify({resumen:'Revisión real',evidencia:'Corte 25',siguienteAccion:'Conciliar banco'})}};
 const html=renderToString(React.createElement(Resultado,props));
 for(const t of ['Revisión real','Corte 25','Conciliar banco','no termina ni aprueba','Guardar para revisión'])assert(html.includes(t));
 const cancelada=renderToString(React.createElement(Resultado,{tarea:{...props.tarea,estado:'cancelada'}}));assert(!cancelada.includes('<form'));
 const {supabase}=await server.ssrLoadModule('/src/supabase.js');
 const {guardarResultadoConsejo}=await server.ssrLoadModule('/src/features/inteligencia/services/seguimientoConsejoService.js');
 let writes=0, patch, filtros=[];
 supabase.auth.getUser=async()=>({data:{user:{id:'u'}}});
 supabase.from=()=>{const q={update(v){writes++;patch=v;return q;},eq(k,v){filtros.push([k,v]);return q;},like(){return q;},neq(){return q;},select(){return q;},async single(){return {data:{id:'a'}};}};return q;};
 const usuario={auth_user_id:'u',organization_id:'o',business_id:'b',branch_id:'s',nombre:'Responsable'};
 await guardarResultadoConsejo({usuario,tareaId:'a',resumen:'Revisado',evidencia:'Corte',siguienteAccion:'Conciliar'});
 assert.equal(writes,1);assert.equal(patch.requiere_revision,true);assert.equal(patch.evaluacion_estado,'revision_humana');assert.equal(patch.estado,undefined);
 for(const k of ['organization_id','business_id','branch_id','id'])assert(filtros.some(f=>f[0]===k));
 supabase.auth.getUser=async()=>({data:{user:{id:'otra'}}});
 await assert.rejects(()=>guardarResultadoConsejo({usuario,tareaId:'a',resumen:'Revisado',evidencia:'Corte',siguienteAccion:'Conciliar'}),/sesión cambió/);assert.equal(writes,1);
 }finally{await server.close();}
});
