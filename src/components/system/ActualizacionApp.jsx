import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
export default function ActualizacionApp(){
 const {needRefresh:[hayActualizacion],updateServiceWorker}=useRegisterSW({onRegisteredSW(_url,registro){registro?.update().catch(()=>{});}});
 useEffect(()=>{const revisar=()=>{if(document.visibilityState==='visible')navigator.serviceWorker?.getRegistration().then(r=>r?.update()).catch(()=>{});};document.addEventListener('visibilitychange',revisar);return()=>document.removeEventListener('visibilitychange',revisar);},[]);
 if(!hayActualizacion)return null;
 return <aside role="status" style={{position:'fixed',bottom:'max(16px, env(safe-area-inset-bottom))',left:12,right:12,maxWidth:550,margin:'0 auto',zIndex:10000,padding:16,borderRadius:16,background:'#49293e',color:'#fff',boxShadow:'0 8px 32px #49293e40'}}><strong>Hay una nueva versión de MONYS</strong><p style={{fontSize:12,lineHeight:1.5,color:'#f7e5ef',margin:'6px 0 10px'}}>Guarda lo que estés capturando antes de actualizar. La pantalla se recargará.</p><button type="button" onClick={()=>updateServiceWorker(true)} style={{padding:'10px 16px',border:0,borderRadius:10,background:'#f3c9dd',color:'#49293e',fontWeight:800}}>Actualizar aplicación</button></aside>;
}
