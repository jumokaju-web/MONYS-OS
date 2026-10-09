import { calcularEquilibrioDiario } from './equilibrioDiario.js';
export function validarMesEquilibrio(mes, dias) {
 if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return {valido:false,motivo:'Selecciona un mes válido.'};
 const [ano, numeroMes] = mes.split('-').map(Number);
 const maximo = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
 if (Number(dias) > maximo) return {valido:false,motivo:`El mes elegido tiene ${maximo} días; los días abiertos no pueden superarlos.`};
 return {valido:true,maximo};
}
export function compararPalancasEquilibrio(datos) {
 const base = calcularEquilibrioDiario(datos);
 if (!base.calculable) return {calculable:false,motivo:base.motivo,opciones:[]};
 const candidatos = [
  {nombre:'Reducir gastos fijos 10%', cambio:{gastosFijos:Number(datos.gastosFijos)*0.9}, condicion:'Comprueba qué gasto puede reducirse sin afectar la operación.', efectoMensual:Number(datos.gastosFijos)*0.1},
  ...(Number(datos.margenBruto)<=98 ? [{nombre:'Mejorar margen bruto 2 puntos',cambio:{margenBruto:Number(datos.margenBruto)+2},condicion:'Requiere validar precios, mezcla de productos y costo de mercancía.'}] : []),
  ...(Number(datos.variablePorcentaje)>0 ? [{nombre:'Reducir costos variables hasta 1 punto',cambio:{variablePorcentaje:Math.max(0,Number(datos.variablePorcentaje)-1)},condicion:'Comprueba comisiones y costos que realmente pueden cambiar.'}] : []),
 ];
 const opciones = candidatos.map(c=>{const r=calcularEquilibrioDiario({...datos,...c.cambio});return {...c,metaDiaria:r.cajaDiaria,reduccionMetaDiaria:Math.max(0,base.cajaDiaria-r.cajaDiaria),brechaDiaria:r.brechaCajaDiaria};}).sort((a,b)=>b.reduccionMetaDiaria-a.reduccionMetaDiaria);
 return {calculable:true,base,opciones};
}
