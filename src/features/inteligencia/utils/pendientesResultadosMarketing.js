export function pendientesResultadosMarketing(campanas = []) {
  const campos = [['venta', 'ventaAcumulada', 'Ventas'], ['pedidos', 'pedidosAcumulados', 'Pedidos'], ['gasto', 'gastoAcumulado', 'Gasto']];
  return campanas.filter((c) => c.estado === 'ACTIVA').flatMap((campana) => {
    const resultado = campana.resultado || {};
    const faltantes = campos.filter(([clave, acumulado]) => {
      const valor = resultado[acumulado];
      const valido = valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor)) && Number(valor) >= 0;
      return !valido || !(resultado.camposConfirmados?.[clave] === true || Number(valor) > 0);
    }).map(([, , etiqueta]) => etiqueta);
    return faltantes.length ? [{ campana, faltantes }] : [];
  });
}
