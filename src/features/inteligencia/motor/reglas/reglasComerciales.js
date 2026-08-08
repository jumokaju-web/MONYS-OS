function generarReglasComerciales({
  metricas,
  crearDecision,
}) {
  const decisiones = [];

  const totalPiezas = Number(
    metricas?.totalPiezas || 0
  );

  const productoMasVendido =
    metricas?.productoMasVendido;

  if (totalPiezas > 0 && productoMasVendido) {
    decisiones.push(
      crearDecision({
        id: "producto-lider",
        tipo: "oportunidad",
        nivel: "alto",
        titulo: "Producto con alta demanda",
        mensaje: `${productoMasVendido.descripcion} es actualmente el producto líder del análisis.`,
        recomendacion:
          "Revisar existencias y asegurar disponibilidad suficiente antes de realizar nuevas compras generales.",
        origen: "Director Comercial IA",
      })
    );
  }

  return decisiones;
}

export {
  generarReglasComerciales,
};