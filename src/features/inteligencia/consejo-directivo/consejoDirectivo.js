export function obtenerResumenConsejo({
  datosDashboard,
}) {
  if (!datosDashboard) {
    return {
      resumen:
        "Todavía no hay información suficiente para generar un análisis.",
      estado: "Esperando información",
      nivel: "🟡",
    };
  }

  const {
    totalPiezas,
    totalProductos,
    productoMasVendido,
  } = datosDashboard.metricas;

  let resumen =
    `Buenos días, Mony.\n\n` +
    `Analicé ${totalProductos} productos vendidos.\n` +
    `Durante este período se movieron ${totalPiezas} piezas.\n\n`;

  if (productoMasVendido) {
    resumen +=
      `El producto líder es:\n` +
      `${productoMasVendido.descripcion}\n` +
      `(${productoMasVendido.cantidad} piezas).\n\n`;
  }

  resumen +=
    "El Consejo Directivo IA continuará analizando la información del negocio para generar recomendaciones estratégicas.";

  return {
    resumen,
    estado: "Consejo Directivo activo",
    nivel: "🟢",
  };
}