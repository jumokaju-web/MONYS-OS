function convertirNumeroReal(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarDatosRentabilidad(valor) {
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
 */
export function obtenerMargenRealBaseCampana(datosRentabilidadBase) {
  const base = normalizarDatosRentabilidad(datosRentabilidadBase);
  if (!base) return null;

  const margenDirecto = convertirNumeroReal(base.margenReal);
  if (margenDirecto !== null) {
    return margenDirecto;
  }

  const productos = Array.isArray(base.productos)
    ? base.productos
    : [];

  if (productos.length === 0) {
    return null;
  }

  let importeBaseTotal = 0;
  let utilidadBaseTotal = 0;

  for (const producto of productos) {
    const importeBase = convertirNumeroReal(producto?.importeBase);
    const utilidadBase = convertirNumeroReal(producto?.utilidadBase);

    if (importeBase === null || utilidadBase === null) {
      return null;
    }

    importeBaseTotal += importeBase;
    utilidadBaseTotal += utilidadBase;
  }

  if (importeBaseTotal <= 0) {
    return null;
  }

  return (utilidadBaseTotal / importeBaseTotal) * 100;
}
