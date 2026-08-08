function generarReglasInventario({
  metricas,
  crearDecision,
}) {
  const decisiones = [];

  const totalProductos = Number(
    metricas?.totalProductos || 0
  );

  if (totalProductos > 0) {
    decisiones.push(
      crearDecision({
        id: "revision-inventario",
        tipo: "prioridad",
        nivel: "medio",
        titulo: "Revisión de inventario",
        mensaje: `El análisis considera ${totalProductos} productos diferentes.`,
        recomendacion:
          "Priorizar la revisión de productos con mayor venta, baja existencia o poca rotación.",
        origen: "Director Inventario IA",
      })
    );
  }

  return decisiones;
}

export {
  generarReglasInventario,
};