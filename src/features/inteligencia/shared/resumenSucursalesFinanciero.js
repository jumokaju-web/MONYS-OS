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

export function consolidarFinanzasSucursales(sucursales = []) {
  const filas = construirComparativoSucursales(sucursales);
  if (!filas.length) return { disponible: false, motivo: "No hay sucursales registradas." };
  if (filas.some(f => f.ventas === null || f.utilidadBruta === null || f.costoInconsistente))
    return { disponible: false, motivo: "Faltan importes SICAR o la utilidad supera las ventas. Revisa los reportes antes de consolidar." };
  if (filas.some(f => !f.periodoInicio || !f.periodoFin || f.periodoInicio > f.periodoFin))
    return { disponible: false, motivo: "Falta un periodo válido para consolidar ventas y gastos." };
  if (filas.length > 1 && !compararRangosSucursales(filas).comparable)
    return { disponible: false, motivo: "Los periodos de las sucursales son distintos. Importa el mismo corte para calcular el resultado del negocio." };
  const fechaInicial = filas[0].periodoInicio;
  const fechaFinal = filas[0].periodoFin;
  const diasAnalizados = (Date.parse(fechaFinal) - Date.parse(fechaInicial)) / 86400000 + 1;
  const ventas = filas.reduce((s, f) => s + f.ventas, 0);
  const utilidad = filas.reduce((s, f) => s + f.utilidadBruta, 0);
  return { disponible: true, ventas, utilidad, costo: ventas - utilidad, margen: ventas > 0 ? utilidad / ventas * 100 : 0, fechaInicial, fechaFinal, diasAnalizados };
}
