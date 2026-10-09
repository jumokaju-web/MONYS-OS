import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
test('la Junta renderiza fechas Date del dashboard sin dejar una pantalla vacía',async()=>{
 process.env.VITE_SUPABASE_URL='https://example.supabase.co';
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-only-placeholder';
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});
 try {
  const {default:Centro}=await server.ssrLoadModule('/src/features/inteligencia/CentroInteligencia.jsx');
  const {UserProvider}=await server.ssrLoadModule('/src/context/UserContext.jsx');
  const metricas={ventasTotales:129853.02,costoTotal:80116.74,utilidadTotal:49736.28,diasAnalizados:7,fechaInicial:new Date('2026-09-07T12:00:00'),fechaFinal:new Date('2026-09-13T12:00:00')};
  const html=renderToString(React.createElement(UserProvider,null,React.createElement(Centro,{datosDashboard:{branch_id:'prueba',metricas,inventario:{detalles:[]},inteligencia:{comercial:{ventas:[]}}},sucursalesDashboard:[],movimientos:[]})));
  assert.match(html,/Junta Directiva/);
  assert.match(html,/Los directores cruzan información/);
 }finally{await server.close();}
});
