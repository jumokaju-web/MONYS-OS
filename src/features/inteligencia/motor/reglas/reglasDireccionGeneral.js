function generarReglasDireccionGeneral({
  metricas,
  decisionesActuales = [],
  crearDecision,
}) {
  const decisiones = [];

  if (!metricas) {
    decisiones.push(
      crearDecision({
        id: "sin-datos",
        tipo: "alerta",
        nivel: "critico",
        titulo: "Información insuficiente",
        mensaje:
          "No hay métricas disponibles para realizar el análisis ejecutivo.",
        recomendacion:
          "Importar o actualizar los reportes del negocio antes de iniciar la reunión diaria.",
        origen: "Director General IA",
      })
    );

    return decisiones;
  }

  if (decisionesActuales.length === 0) {
    decisiones.push(
      crearDecision({
        id: "operacion-estable",
        tipo: "recomendacion",
        nivel: "bajo",
        titulo: "Operación estable",
        mensaje:
          "No se detectaron alertas relevantes con la información disponible.",
        recomendacion:
          "Mantener el seguimiento diario y actualizar los reportes antes de la siguiente reunión.",
        origen: "Director General IA",
      })
    );
  }

  return decisiones;
}

export {
  generarReglasDireccionGeneral,
};