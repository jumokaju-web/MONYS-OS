// ======================================================
// MONYS ERP AI
// Analizador Comercial
// Archivo: ventasAnalyzer.js
// ======================================================

export function analizarVentas(datosDashboard) {
  const metricas = datosDashboard?.metricas || {};

  const totalProductos = metricas.totalProductos || 0;
  const totalPiezas = metricas.totalPiezas || 0;
  const productoMasVendido = metricas.productoMasVendido;

  const recomendaciones = [];

  if (productoMasVendido) {
    recomendaciones.push({
      prioridad: "alta",
      titulo: "Producto líder",
      mensaje: `Mantener inventario suficiente de "${productoMasVendido.descripcion}".`
    });
  }

  if (totalPiezas > 1000) {
    recomendaciones.push({
      prioridad: "media",
      titulo: "Buen volumen de ventas",
      mensaje:
        "Las ventas muestran un volumen importante. Evalúa incrementar inventario de los productos con mayor rotación."
    });
  }

  if (totalProductos < 50) {
    recomendaciones.push({
      prioridad: "media",
      titulo: "Pocas referencias",
      mensaje:
        "Analiza ampliar el catálogo para incrementar oportunidades de venta."
    });
  }

  return {
    resumen: {
      totalProductos,
      totalPiezas,
      productoMasVendido
    },
    recomendaciones
  };
}