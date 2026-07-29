// ======================================================
// MONYS ERP AI
// Analizador de Inventario
// Archivo: inventarioAnalyzer.js
// ======================================================

export function analizarInventario(detalles = []) {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return {
      resumen: {
        totalProductos: 0,
        productosConExistencia: 0,
        productosAgotados: 0,
        productosNegativos: 0,
        existenciaTotal: 0,
        valorInventario: 0,
      },
      alertas: [],
    };
  }

  let productosConExistencia = 0;
  let productosAgotados = 0;
  let productosNegativos = 0;
  let existenciaTotal = 0;
  let valorInventario = 0;

  const alertas = [];

  detalles.forEach((detalle) => {
    const existencia =
      Number(
        detalle?.existencia ??
          detalle?.exis ??
          detalle?.datos_originales?.existencia ??
          detalle?.datos_originales?.exis
      ) || 0;

    const precioCompra =
      Number(
        detalle?.precioCompra ??
          detalle?.precio_compra ??
          detalle?.precioUnitario ??
          detalle?.precio_unitario ??
          detalle?.datos_originales?.precioCompra ??
          detalle?.datos_originales?.precio_compra ??
          detalle?.datos_originales?.precioUnitario ??
          detalle?.datos_originales?.precio_unitario
      ) || 0;

    const descripcion =
      detalle?.descripcion ||
      detalle?.datos_originales?.descripcion ||
      "Producto sin descripción";

    existenciaTotal += existencia;
    valorInventario += existencia * precioCompra;

    if (existencia > 0) {
      productosConExistencia += 1;
    }

    if (existencia === 0) {
      productosAgotados += 1;

      alertas.push({
        tipo: "agotado",
        prioridad: "alta",
        descripcion,
        existencia,
        mensaje: "Producto sin existencia disponible.",
      });
    }

    if (existencia < 0) {
      productosNegativos += 1;

      alertas.push({
        tipo: "negativo",
        prioridad: "critica",
        descripcion,
        existencia,
        mensaje:
          "Producto con existencia negativa. Requiere revisión física y administrativa.",
      });
    }
  });

  return {
    resumen: {
      totalProductos: detalles.length,
      productosConExistencia,
      productosAgotados,
      productosNegativos,
      existenciaTotal,
      valorInventario,
    },
    alertas,
  };
}