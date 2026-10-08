export function validarCarga({branchId,tipoReporte,datosNormalizados}) {
 if(!branchId || typeof branchId!=='string' || !branchId.trim()) throw new Error('Selecciona la sucursal del reporte antes de guardar.');
 if(!tipoReporte || typeof tipoReporte!=='string')throw new Error('Falta identificar el tipo de reporte.');
 if(!Array.isArray(datosNormalizados)||datosNormalizados.length===0)throw new Error('El reporte no tiene registros válidos para importar.');
 if(datosNormalizados.some(f=>!f || typeof f!=='object' || Array.isArray(f)))throw new Error('Hay registros inválidos. Vuelve a analizar el archivo.');
 return true;
}
