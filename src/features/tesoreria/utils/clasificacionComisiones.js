import { validarEstadoBancario } from './validarEstadoBancario.js';
const conceptos = new Set(['APLI TASA DE DES DEBITO', 'IVA TASA DE DESC DEBITO', 'APLI TASA DE DES CREDITO', 'IVA TASA DE DESC CREDITO', 'COM VTAS TDC INTER', 'IVA COM VTAS TDC INTER', 'SERV BANCA INTERNET', 'IVA COM SERV BCA INTERNET']);
export function prepararComisiones(paquete, cuenta = '') {
 validarEstadoBancario(paquete);
 const movimientos = paquete.movimientos.filter(m => (!cuenta || m.cuenta === cuenta) && m.revision?.estado !== 'Confirmado' && m.categoria === 'Comisión bancaria / IVA' && conceptos.has(m.descripcion.trim().toUpperCase()) && Number(m.cargo) > 0 && Number(m.abono) === 0);
 return { movimientos, importe: movimientos.reduce((s,m) => s + Math.round(Number(m.cargo)*100),0)/100 };
}
export function clasificarComisiones(paquete, cuenta = '', fecha = new Date().toISOString()) {
 const plan = prepararComisiones(paquete, cuenta); const ids = new Set(plan.movimientos.map(m => m.id));
 const nuevo = {...paquete, movimientos: paquete.movimientos.map(m => ids.has(m.id) ? {...m, revision: {estado:'Confirmado', clasificacion:'Comisión bancaria / IVA', fecha, nota:`Comisión o IVA identificado explícitamente por el banco: ${m.descripcion}; ${m.fecha_operacion}, cuenta ${m.cuenta}, cargo $${m.cargo}. Clasificación de concepto bancario en bloque. Pendiente asignación a tienda, flotilla o uso personal y tratamiento fiscal; no presume gasto deducible.`}} : m)};
 validarEstadoBancario(nuevo); return nuevo;
}
const conceptosTerminal = new Set(['VENTAS DEBITO', 'VENTAS CREDITO', 'VENTAS TDC INTER']);
export function prepararTerminales(paquete, cuenta = '') {
 validarEstadoBancario(paquete);
 const movimientos = paquete.movimientos.filter(m => (!cuenta || m.cuenta === cuenta) && m.revision?.estado !== 'Confirmado' && m.categoria === 'Abono de terminal: conciliar SICAR' && conceptosTerminal.has(m.descripcion.trim().toUpperCase()) && Number(m.abono) > 0 && Number(m.cargo) === 0);
 return {movimientos, importe: movimientos.reduce((s,m)=>s+Math.round(Number(m.abono)*100),0)/100};
}
export function clasificarTerminales(paquete, cuenta = '', fecha = new Date().toISOString()) {
 const plan = prepararTerminales(paquete,cuenta); const ids = new Set(plan.movimientos.map(m=>m.id));
 const nuevo = {...paquete,movimientos:paquete.movimientos.map(m=>ids.has(m.id)?{...m,revision:{estado:'Confirmado',clasificacion:'Cobro de tienda: conciliar SICAR',fecha,nota:`Abono de terminal identificado por el banco: ${m.descripcion}; ${m.fecha_operacion}, cuenta ${m.cuenta}, abono $${m.abono}. Pendiente conciliar con SICAR y asignar sucursal. No registrar otra venta ni presumir una coincidencia contable ya verificada.`}}:m)};
 validarEstadoBancario(nuevo);return nuevo;
}
