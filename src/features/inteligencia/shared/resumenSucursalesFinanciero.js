function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function construirComparativoSucursales(sucursales = []) {
  return (Array.isArray(sucursales) ? sucursales : []).map((sucursal, indice) => {
    const ventas = numeroRegistrado(sucursal?.ventasTotales);
    const utilidadBruta = numeroRegistrado(sucursal?.utilidadTotal);

    return {
      id: sucursal?.branch_id || sucursal?.id || `sucursal-${indice + 1}`,
      nombre: sucursal?.nombre || sucursal?.branch_name || `Sucursal ${indice + 1}`,
      ventas,
      costoMercancia: ventas !== null && utilidadBruta !== null
        ? ventas - utilidadBruta
        : null,
      utilidadBruta,
      margenBruto: ventas !== null && ventas > 0 && utilidadBruta !== null
        ? (utilidadBruta / ventas) * 100
        : null,
      costoInconsistente: ventas !== null && utilidadBruta !== null
        ? utilidadBruta > ventas
        : false,
    };
  });
}
