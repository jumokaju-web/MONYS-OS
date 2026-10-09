function limpiar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dinero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto.replace(/[$,\s]/g, ""));
  return Number.isFinite(numero) ? numero : null;
}

function redondear(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function indice(encabezados, opciones) {
  return encabezados.findIndex((valor) => opciones.includes(limpiar(valor)));
}

export function reconciliarUtilidadVentas(filasReporte = [], datosNormalizados = []) {
  if (!Array.isArray(filasReporte) || filasReporte.length < 2) {
    return { estado: "sin_control", mensaje: "No se encontró el detalle y el total del reporte SICAR." };
  }

  const encabezados = filasReporte[0] || [];
  const columnas = {
    venta: indice(encabezados, ["total ven", "total venta", "total ventas"]),
    costo: indice(encabezados, ["total com", "total compra", "total compras", "costo"]),
    utilidad: indice(encabezados, ["utilidad"]),
  };
  if (Object.values(columnas).some((columna) => columna < 0)) {
    return { estado: "sin_control", mensaje: "Faltan columnas para cotejar venta, costo y utilidad." };
  }

  const filaTotal = filasReporte.find((fila) =>
    Array.isArray(fila) && fila.some((valor) => limpiar(valor) === "total ventas")
  );
  let totalesSicar = filaTotal
    ? {
        venta: dinero(filaTotal[columnas.venta]),
        costo: dinero(filaTotal[columnas.costo]),
        utilidad: dinero(filaTotal[columnas.utilidad]),
      }
    : null;

  // Algunas exportaciones de SICAR muestran el resumen en dos filas:
  // encabezados "Ventas | Compra | Utilidad" y, debajo, sus importes.
  // Se busca desde el final para no confundir los encabezados del detalle.
  if (!totalesSicar) {
    const aliasTotales = {
      venta: new Set(["venta", "ventas", "total ven", "total venta", "total ventas"]),
      costo: new Set(["compra", "compras", "costo", "total com", "total compra", "total compras"]),
      utilidad: new Set(["utilidad", "utilidades", "total utilidad"]),
    };
    let filaEtiquetas = null;
    for (let indiceFila = filasReporte.length - 1; indiceFila >= 0; indiceFila -= 1) {
      const fila = filasReporte[indiceFila];
      if (!Array.isArray(fila)) continue;
      const indiceMarca = filasReporte.slice(Math.max(0, indiceFila - 3), indiceFila).findIndex((filaAnterior) =>
        Array.isArray(filaAnterior) && filaAnterior.some((valor) => limpiar(valor) === "totales")
      );
      if (indiceMarca < 0) continue;

      const indices = {};
      fila.forEach((valor, indiceColumna) => {
        const etiqueta = limpiar(valor);
        for (const [campo, alias] of Object.entries(aliasTotales)) {
          if (alias.has(etiqueta) && indices[campo] == null) indices[campo] = indiceColumna;
        }
      });
      if (Object.keys(aliasTotales).every((campo) => indices[campo] != null)) {
        filaEtiquetas = { indiceFila, indices };
        break;
      }
    }

    if (filaEtiquetas) {
      const filaValores = filasReporte.slice(filaEtiquetas.indiceFila + 1).find((fila) =>
        Array.isArray(fila)
        && Object.values(filaEtiquetas.indices).every((indiceColumna) => dinero(fila[indiceColumna]) != null)
      );
      if (filaValores) {
        totalesSicar = {
          venta: dinero(filaValores[filaEtiquetas.indices.venta]),
          costo: dinero(filaValores[filaEtiquetas.indices.costo]),
          utilidad: dinero(filaValores[filaEtiquetas.indices.utilidad]),
        };
      }
    }
  }

  if (!totalesSicar) {
    return { estado: "sin_control", mensaje: "El archivo no incluye una fila de totales SICAR reconocible." };
  }
  if (Object.values(totalesSicar).some((valor) => valor == null)) {
    return { estado: "sin_control", mensaje: "No se pudieron leer todos los importes de la fila Total Ventas de SICAR." };
  }

  const suma = (campo) => (Array.isArray(datosNormalizados) ? datosNormalizados : [])
    .reduce((total, fila) => total + (Number(fila?.[campo]) || 0), 0);
  const totalesLeidos = {
    venta: redondear(suma("ventaTotal")),
    costo: redondear(suma("costoTotal")),
    utilidad: redondear(suma("utilidad")),
  };
  const diferencias = {
    venta: redondear(totalesLeidos.venta - totalesSicar.venta),
    costo: redondear(totalesLeidos.costo - totalesSicar.costo),
    utilidad: redondear(totalesLeidos.utilidad - totalesSicar.utilidad),
  };
  const estado = Object.values(diferencias).every((valor) => valor === 0)
    ? "conciliado"
    : "diferencia";

  return {
    estado,
    mensaje: estado === "conciliado"
      ? "Las ventas, el costo y la utilidad leídos coinciden con la fila de totales SICAR."
      : "Los importes extraídos no coinciden con la fila de totales SICAR.",
    totalesSicar,
    totalesLeidos,
    diferencias,
  };
}
