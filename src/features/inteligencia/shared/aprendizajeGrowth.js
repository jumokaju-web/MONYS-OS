const PLACEHOLDERS_DE_APRENDIZAJE = new Set([
  "pendiente",
  "sin dato",
  "sin datos",
  "no disponible",
  "por confirmar",
  "requiere mas datos",
  "requiere_mas_datos",
]);

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
    if (typeof valor !== "string") return false;
    const normalizado = valor.trim().toLocaleLowerCase("es-MX")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return normalizado.length > 0 && !PLACEHOLDERS_DE_APRENDIZAJE.has(normalizado);
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
