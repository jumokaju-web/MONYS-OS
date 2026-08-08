const PUNTOS_POR_NIVEL = {
  critico: 100,
  alto: 75,
  medio: 50,
  bajo: 25,
};

const PUNTOS_POR_TIPO = {
  alerta: 30,
  riesgo: 25,
  prioridad: 20,
  oportunidad: 15,
  recomendacion: 10,
};

const PUNTOS_POR_ORIGEN = {
  "Director General IA": 20,
  "Director Financiero IA": 18,
  "Director Inventario IA": 16,
  "Director Comercial IA": 14,
};

function calcularPuntuacionDecision(decision) {
  const puntosNivel =
    PUNTOS_POR_NIVEL[decision?.nivel] || 0;

  const puntosTipo =
    PUNTOS_POR_TIPO[decision?.tipo] || 0;

  const puntosOrigen =
    PUNTOS_POR_ORIGEN[decision?.origen] || 0;

  return puntosNivel + puntosTipo + puntosOrigen;
}

function priorizarDecisiones(decisiones = []) {
  return decisiones
    .map((decision) => ({
      ...decision,
      puntuacion: calcularPuntuacionDecision(decision),
    }))
    .sort(
      (decisionA, decisionB) =>
        decisionB.puntuacion -
        decisionA.puntuacion
    );
}

export {
  calcularPuntuacionDecision,
  priorizarDecisiones,
};