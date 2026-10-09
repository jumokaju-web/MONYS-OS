function convertirNumeroReal(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarObjeto(valor) {
  if (valor && typeof valor === "object") {
    return valor;
  }

  if (typeof valor === "string") {
    try {
      const resultado = JSON.parse(valor);
      return resultado && typeof resultado === "object"
        ? resultado
        : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Devuelve el margen SICAR de una campaña.
 * En campañas multiproducto pondera la utilidad/venta histórica de cada producto.
 * Acepta estrategia completa para recuperar campañas creadas antes del nuevo formato.
 */
export function obtenerMargenRealBaseCampana(estrategiaOCampana) {
  const estrategia = normalizarObjeto(estrategiaOCampana);
  if (!estrategia) return null;

  const base = normalizarObjeto(estrategia.datosRentabilidadBase) || estrategia;
  const margenDirecto = convertirNumeroReal(base.margenReal);
  if (margenDirecto !== null) {
    return margenDirecto;
  }

  const listasProductos = [
    base.productos,
    estrategia.productosSeleccionadosGrowth,
  ].filter((productos) => Array.isArray(productos) && productos.length > 0);

  for (const productos of listasProductos) {
    let importeBaseTotal = 0;
    let utilidadBaseTotal = 0;
    let datosCompletos = true;

    for (const producto of productos) {
      const importeBase = convertirNumeroReal(
        producto?.importeBase ?? producto?.importe,
      );
      const utilidadBase = convertirNumeroReal(
        producto?.utilidadBase ?? producto?.utilidad,
      );

      if (importeBase === null || utilidadBase === null) {
        datosCompletos = false;
        break;
      }

      importeBaseTotal += importeBase;
      utilidadBaseTotal += utilidadBase;
    }

    if (datosCompletos && importeBaseTotal > 0) {
      return (utilidadBaseTotal / importeBaseTotal) * 100;
    }
  }

  return null;
}
