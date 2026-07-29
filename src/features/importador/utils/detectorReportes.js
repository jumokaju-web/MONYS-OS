// ======================================================
// MONYS ERP AI
// Detector inteligente de reportes SICAR
// Archivo: detectorReportes.js
// ======================================================

function limpiarEncabezado(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\-_]/g, " ")
    .replace(/%/g, " porcentaje")
    .replace(/\s+/g, " ")
    .trim();
}

function contieneAlgunaColumna(encabezados, opciones) {
  return opciones.some((opcion) =>
    encabezados.includes(limpiarEncabezado(opcion))
  );
}

export function detectarReporte(encabezados = []) {
  if (!Array.isArray(encabezados) || encabezados.length === 0) {
    return "Reporte desconocido";
  }

  const columnas = encabezados
    .map(limpiarEncabezado)
    .filter((encabezado) => encabezado !== "");

  const tieneCodigo = contieneAlgunaColumna(columnas, [
    "codigo",
    "codigo art",
    "codigo articulo",
    "clave",
    "sku",
  ]);

  const tieneDescripcion = contieneAlgunaColumna(columnas, [
    "descripcion",
    "producto",
    "articulo",
    "nombre",
  ]);

  const tieneCantidad = contieneAlgunaColumna(columnas, [
    "cantidad",
    "piezas",
  ]);

  const tieneExistencia = contieneAlgunaColumna(columnas, [
    "existencia",
    "existencias",
    "exis",
  ]);

  const tienePrecioVenta = contieneAlgunaColumna(columnas, [
    "precio venta",
    "precio de venta",
    "precio v",
  ]);

  const tienePrecioCompra = contieneAlgunaColumna(columnas, [
  "precio compra",
  "precio de compra",
  "precio c",
  "costo",
]);

  const tieneMargen = contieneAlgunaColumna(columnas, [
    "margen",
    "margen porcentaje",
  ]);

 const tieneUtilidadUnitaria = contieneAlgunaColumna(columnas, [
  "utilidad unitaria",
  "utilidad uni",
]);

  const tieneUtilidadTotal = contieneAlgunaColumna(columnas, [
    "utilidad total",
  ]);

  const tienePrecioUnitario = contieneAlgunaColumna(columnas, [
    "precio u",
    "precio unitario",
  ]);

  const tieneTotal = contieneAlgunaColumna(columnas, [
    "total",
  ]);

  /*
   * Inventario / Utilidad debe evaluarse antes que Inventario,
   * porque también contiene columnas de existencia.
   */
  if (
    tieneCodigo &&
    tieneDescripcion &&
    tieneExistencia &&
    tienePrecioVenta &&
    tienePrecioCompra &&
    (tieneMargen ||
      tieneUtilidadUnitaria ||
      tieneUtilidadTotal)
  ) {
    return "Inventario / Utilidad";
  }

  if (
    tieneCodigo &&
    tieneDescripcion &&
    tieneExistencia &&
    (tienePrecioUnitario || tieneTotal)
  ) {
    return "Inventario";
  }

  if (
    tieneCodigo &&
    tieneDescripcion &&
    tieneCantidad
  ) {
    return "Ventas por artículo";
  }
   
  console.log({
  columnas,
  tieneCodigo,
  tieneDescripcion,
  tieneExistencia,
  tienePrecioVenta,
  tienePrecioCompra,
  tieneMargen,
  tieneUtilidadUnitaria,
  tieneUtilidadTotal,
});

  return "Reporte desconocido";
}

export function encontrarFilaEncabezados(filas = []) {
  if (!Array.isArray(filas) || filas.length === 0) {
    return -1;
  }

  const limiteBusqueda = Math.min(filas.length, 30);

  for (let indice = 0; indice < limiteBusqueda; indice += 1) {
    const fila = filas[indice];

    if (!Array.isArray(fila)) {
      continue;
    }

    const reporteDetectado = detectarReporte(fila);

   console.log(
  "Fila",
  indice,
  "=>",
  detectarReporte(fila),
  fila
);

    if (reporteDetectado !== "Reporte desconocido") {
      return indice;
    }
  }

  return -1;
}