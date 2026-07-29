export function generarMensajeDirectorGeneral(metricas) {
  if (!metricas) {
    return {
      saludo: "Buenos días, Jefa.",
      estado: "No hay información suficiente para analizar.",
      hallazgos: [],
      recomendaciones: [],
    };
  }

  const hallazgos = [];
  const recomendaciones = [];

  if (metricas.totalProductos > 0) {
    hallazgos.push(
      `Se analizaron ${metricas.totalProductos} productos diferentes.`
    );
  }

  if (metricas.totalPiezas > 0) {
    hallazgos.push(
      `Se registraron ${metricas.totalPiezas} piezas vendidas.`
    );
  }

  if (metricas.productoMasVendido?.descripcion) {
    hallazgos.push(
      `El producto líder fue "${metricas.productoMasVendido.descripcion}".`
    );

    recomendaciones.push(
      "Verificar el inventario del producto con mayor demanda."
    );
  }

  recomendaciones.push(
    "Revisar el comportamiento comercial antes de realizar nuevas compras."
  );

  return {
    saludo: "Buenos días, Mony.",
    estado: "La operación fue analizada correctamente.",
    hallazgos,
    recomendaciones,
  };
}