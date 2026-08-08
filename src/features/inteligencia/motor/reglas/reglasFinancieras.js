function generarReglasFinancieras({
  movimientos = [],
  crearDecision,
}) {
  const decisiones = [];

  if (movimientos.length === 0) {
    decisiones.push(
      crearDecision({
        id: "sin-movimientos",
        tipo: "riesgo",
        nivel: "medio",
        titulo: "Tesorería sin movimientos",
        mensaje:
          "No existen movimientos registrados para complementar el análisis financiero.",
        recomendacion:
          "Registrar entradas, salidas y pagos pendientes para mejorar la calidad de las decisiones.",
        origen: "Director Financiero IA",
      })
    );
  }

  return decisiones;
}

export {
  generarReglasFinancieras,
};