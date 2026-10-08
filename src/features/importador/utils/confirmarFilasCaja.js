export function confirmarFilasCaja(guardadas,esperadas) {
 if(!Number.isInteger(guardadas)||guardadas!==esperadas) throw new Error(`Caja guardó ${Number.isInteger(guardadas)?guardadas:'una cantidad sin confirmar'} de ${esperadas} filas. La carga queda pendiente de revisión; no reimportes automáticamente.`);
 return true;
}
