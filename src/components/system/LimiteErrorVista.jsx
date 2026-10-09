import { Component } from 'react';
export default class LimiteErrorVista extends Component {
 state={error:null};
 static getDerivedStateFromError(error){return {error};}
 render(){
  if(!this.state.error)return this.props.children;
  return <main style={{maxWidth:700,margin:'60px auto',padding:28,background:'white',border:'1px solid #dfd3dd',borderRadius:16,textAlign:'left'}}><span style={{fontSize:11,color:'#8b4b70',fontWeight:800}}>MONYS OS · RECUPERAR VISTA</span><h1 style={{fontSize:27}}>Esta pantalla necesita revisión</h1><p style={{fontSize:14,lineHeight:1.6}}>Ocurrió un error al mostrar el módulo. Puedes volver al inicio para continuar.</p><button onClick={this.props.onVolver} style={{marginTop:20,padding:'12px 18px',border:0,borderRadius:9,background:'#713657',color:'white',cursor:'pointer'}}>Volver al inicio</button><details style={{marginTop:20,fontSize:12}}><summary>Detalle del error</summary><p>{String(this.state.error?.message || 'Error de visualización')}</p></details></main>;
 }
}
