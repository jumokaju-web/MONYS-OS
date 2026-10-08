import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioValor } from '../../src/features/valor/valorRepository.js';
const usuario={auth_user_id:'auth',organization_id:'org',business_id:'business',branch_id:'branch',nombre:'Directora'};
const id='550e8400-e29b-41d4-a716-446655440000';
const base={id,tipo:'INICIATIVA_VALOR_V1',titulo:'Prueba',hipotesis:'Rotar',indicador:'utilidad_bruta',base:100,dias:7,fuenteBase:'Reporte',fecha:'2026-10-15',estadoMedicion:'BASE_REGISTRADA'};
function crearDb({role='owner',authId='auth',activa=true,tarea={id,resultado:JSON.stringify(base),updated_at:'version-1'},conflicto=false}={}) {
 const consultas=[];
 class Query {
  constructor(tabla){this.tabla=tabla;this.filters=[];this.op='select';consultas.push(this);}
  select(){return this;} eq(k,v){this.filters.push([k,v]);return this;} is(k,v){this.filters.push([k,v]);return this;} like(){return this;} or(){return this;} order(){return this;} limit(){return this;} single(){this.una=true;return this;} maybeSingle(){this.una=true;return this;}
  insert(v){this.op='insert';this.payload=v;return this;} update(v){this.op='update';this.payload=v;return this;}
  then(resolve,reject){let response;
   if(this.tabla==='usuarios')response={data:{...usuario,id:'profile',role,active:activa},error:null};
   else if(this.op==='insert')response={data:{...this.payload},error:null};
   else if(this.op==='update')response={data:conflicto?null:{...tarea,...this.payload},error:null};
   else response={data:this.una?tarea:[],error:null};
   return Promise.resolve(response).then(resolve,reject);
  }
 }
 return {consultas,auth:{getUser:async()=>({data:{user:{id:authId}},error:null})},from:tabla=>new Query(tabla)};
}
test('Consulta ambos registros con organización, negocio y sucursal; rechaza sesión y rol ajenos',async()=>{const db=crearDb();await crearServicioValor(db).cargarCentroValor(usuario);for(const q of db.consultas.filter(q=>q.tabla!=='usuarios')){assert.deepEqual(q.filters,[['organization_id','org'],['business_id','business'],['branch_id','branch']]);}await assert.rejects(crearServicioValor(crearDb({role:'empleado'})).cargarCentroValor(usuario));await assert.rejects(crearServicioValor(crearDb({authId:'otra'})).cargarCentroValor(usuario));await assert.rejects(crearServicioValor(crearDb({activa:false})).cargarCentroValor(usuario));});
test('Crea una tarea con evidencia requerida, estado pendiente e identificador estable',async()=>{const db=crearDb();const registro=await crearServicioValor(db).crearIniciativaValor(usuario,base);assert.equal(registro.id,id);assert.equal(registro.organization_id,'org');assert.equal(registro.responsable,'Directora');assert.equal(registro.requiere_evidencia,true);assert.equal(registro.estado,'pendiente');assert.equal(JSON.parse(registro.resultado).estadoMedicion,'BASE_REGISTRADA');});
test('No acepta un cambio de contexto ni un resultado sin evidencia',async()=>{const db=crearDb();await assert.rejects(crearServicioValor(db).crearIniciativaValor({...usuario,business_id:'otro'},base));assert.equal(db.consultas.some(q=>q.op==='insert'),false);await assert.rejects(crearServicioValor(db).registrarResultadoValor(usuario,{id},{observado:150,costo:0,dias:7,evidencia:'',aprendizaje:'Algo'}));assert.equal(db.consultas.some(q=>q.op==='update'),false);});
test('Guarda el resultado separado de la revisión y usa control de concurrencia',async()=>{const db=crearDb();const t=await crearServicioValor(db).registrarResultadoValor(usuario,{id},{observado:150,costo:10,dias:7,evidencia:'Reporte',aprendizaje:'Rotación'});assert.equal(JSON.parse(t.resultado).estadoMedicion,'RESULTADO_REGISTRADO');assert.equal(t.estado,'en_proceso');const q=db.consultas.find(q=>q.op==='update');assert.ok(q.filters.some(([k,v])=>k==='updated_at' && v==='version-1'));await assert.rejects(crearServicioValor(crearDb({conflicto:true})).registrarResultadoValor(usuario,{id},{observado:150,costo:10,dias:7,evidencia:'Reporte',aprendizaje:'Rotación'}),/Otro usuario/);});
test('La revisión conserva evidencia e historial y bloquea repetir un resultado revisado',async()=>{const tarea={id,updated_at:'version-1',resultado:JSON.stringify({...base,estadoMedicion:'RESULTADO_REGISTRADO',resultado:{observado:150,costo:10,dias:7,evidencia:'Reporte',aprendizaje:'Rotación'}})};const db=crearDb({tarea});const revisada=await crearServicioValor(db).revisarResultadoValor(usuario,{id});const r=JSON.parse(revisada.resultado);assert.equal(r.estadoMedicion,'REVISADA');assert.equal(r.revisadaPor,'Directora');assert.equal(r.historial.length,1);await assert.rejects(crearServicioValor(crearDb({tarea:revisada})).registrarResultadoValor(usuario,{id},{observado:170,costo:10,dias:7,evidencia:'Reporte',aprendizaje:'Otra'}),/ya fue revisado/);});
