const CAMPOS_DE_APRENDIZAJE = [
  "resumenIA",
  "decisionFutura",
  "recomendacionFutura",
  "resumen",
  "recomendacion",
  "conclusion",
];

function tieneAprendizajeEscrito(aprendizaje) {
  if (typeof aprendizaje === "string") {
    return aprendizaje.trim().length > 0;
  }

  if (!aprendizaje || typeof aprendizaje !== "object") {
    return false;
  }

  return CAMPOS_DE_APRENDIZAJE.some((campo) => {
    const valor = aprendizaje[campo];
    return typeof valor === "string" && valor.trim().length > 0;
  });
}

export function hayAprendizajeGrowth({
  aprendizaje,
  campanasFinalizadas = [],
} = {}) {
  return (
    tieneAprendizajeEscrito(aprendizaje) ||
    (Array.isArray(campanasFinalizadas) &&
      campanasFinalizadas.some((campana) =>
        tieneAprendizajeEscrito(campana?.aprendizaje),
      ))
  );
}
