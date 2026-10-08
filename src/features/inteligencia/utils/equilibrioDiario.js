function numero(v) { if((typeof v === 'string' && !v.trim()) || v == null || !['string','number'].includes(typeof v)) return null; const n=Number(v);return Number.isFinite(n) && n>=0?n:null; }
export function calcularEquilibrioDiario(datos={}) {
 const campos=['gastosFijos','margenBruto','variablePorcentaje','diasAbiertos','deuda','ventaPrevista'];
 const n=Object.fromEntries(campos.map(c=>[c,numero(datos[c])]));
 const faltantes=campos.filter(c=>n[c]===null);
 if(faltantes.length) return {calculable:false,faltantes,motivo:'Completa todos los datos; 0 debe representar un importe confirmado.'};
 if(!Number.isInteger(n.diasAbiertos)||n.diasAbiertos<1||n.diasAbiertos>31||n.margenBruto>100||n.variablePorcentaje>100) return {calculable:false,faltantes:[],motivo:'Revisa días abiertos (1–31) y porcentajes (0–100).'};
 const contribucion=(n.margenBruto-n.variablePorcentaje)/100;
 if(contribucion<=0) return {calculable:false,faltantes:[],motivo:'El margen disponible después de costos variables debe ser positivo. Vender más con esta estructura no cubre los compromisos.'};
 const operacion=n.gastosFijos/contribucion;
 const caja=(n.gastosFijos+n.deuda)/contribucion;
 const contribucionPrevista=n.ventaPrevista*contribucion;
 return {calculable:true,faltantes:[],contribucion,operacion,caja,operacionDiaria:operacion/n.diasAbiertos,cajaDiaria:caja/n.diasAbiertos,brechaOperacion:Math.max(0,operacion-n.ventaPrevista),brechaCaja:Math.max(0,caja-n.ventaPrevista),excedenteOperacion:contribucionPrevista-n.gastosFijos,excedenteDespuesDeuda:contribucionPrevista-n.gastosFijos-n.deuda};
}
