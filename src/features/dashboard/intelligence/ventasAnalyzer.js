/*
  =======================================================
  MONYS ERP AI
  Analizador de Ventas
  =======================================================

  Este módulo recibe la información procesada del Dashboard
  y genera conclusiones relacionadas exclusivamente con ventas.

  En el futuro este archivo analizará:

  - Productos estrella
  - Productos con baja rotación
  - Categorías más fuertes
  - Marcas líderes
  - Tendencias de venta
  - Comparativos diarios
  - Comparativos mensuales

  El Director General IA utilizará este analizador para
  tomar decisiones.
*/

export function analizarVentas(datosDashboard) {
  if (!datosDashboard?.metricas) {
    return {
      resumen: [],
    };
  }

  const {
    totalPiezas = 0,
    totalProductos = 0,
    productoMasVendido = null,
  } = datosDashboard.metricas;

  const resumen = [];

  if (productoMasVendido) {
    resumen.push({
      tipo: "producto_estrella",
      prioridad: "alta",
      titulo: "Producto estrella",
      descripcion:
        `${productoMasVendido.descripcion} ` +
        `lidera las ventas con ` +
        `${productoMasVendido.cantidad} piezas.`,
    });
  }

  resumen.push({
    tipo: "ventas",
    prioridad: "media",
    titulo: "Volumen vendido",
    descripcion:
      `${totalPiezas.toLocaleString("es-MX")} piezas ` +
      `registradas en el reporte.`,
  });

  resumen.push({
    tipo: "catalogo",
    prioridad: "baja",
    titulo: "Productos analizados",
    descripcion:
      `${totalProductos.toLocaleString("es-MX")} productos diferentes.`,
  });

  return {
    resumen,
  };
}