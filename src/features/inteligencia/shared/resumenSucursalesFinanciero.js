function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function fechaCorta(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const texto = String(valor).trim();
  const fecha = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return fecha ? `${fecha[1]}-${fecha[2]}-${fecha[3]}` : null;
}

function mostrarFecha(valor) {
  if (!valor) return null;
  const [, anio, mes, dia] = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  return anio ? `${dia}/${mes}/${anio}` : null;
}

export function construirComparativoSucursales(sucursales = []) {
  return (Array.isArray(sucursales) ? sucursales : []).map((sucursal, indice) => {
    const ventas = numeroRegistrado(sucursal?.ventasTotales);
    const utilidadBruta = numeroRegistrado(sucursal?.utilidadTotal);
    const periodo = sucursal?.periodo || {};
    const periodoInicio = fechaCorta(periodo.fechaInicial ?? periodo.fechaInicio);
    const periodoFin = fechaCorta(periodo.fechaFinal ?? periodo.fechaFin);
    const periodoEtiqueta = periodoInicio && periodoFin
      ? `${mostrarFecha(periodoInicio)} al ${mostrarFecha(periodoFin)}`
      : null;

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
      periodoInicio,
      periodoFin,
      periodoEtiqueta,
    };
  });
}

export function compararRangosSucursales(sucursales = []) {
  const lista = Array.isArray(sucursales) ? sucursales : [];
  if (lista.length < 2) {
    return { comparable: false, estado: "UNA_SUCURSAL", mensaje: "Se necesita más de una sucursal para comparar cortes." };
  }

  if (lista.some((sucursal) => !sucursal?.periodoInicio || !sucursal?.periodoFin)) {
    return { comparable: false, estado: "FECHA_FALTANTE", mensaje: "No se muestran líderes: faltan fechas de transacciones para confirmar que los periodos coinciden." };
  }

  const rangos = new Set(lista.map((sucursal) => `${sucursal.periodoInicio}/${sucursal.periodoFin}`));
  if (rangos.size > 1) {
    return { comparable: false, estado: "CORTES_DISTINTOS", mensaje: "No se muestran líderes: las sucursales tienen rangos de transacciones distintos. Alinea las fechas en SICAR y vuelve a importar." };
  }

  return { comparable: true, estado: "MISMO_RANGO", mensaje: `Mismo rango de fechas detectado en los tickets importados: ${lista[0].periodoEtiqueta}. Valida también las horas del filtro SICAR.` };
}
