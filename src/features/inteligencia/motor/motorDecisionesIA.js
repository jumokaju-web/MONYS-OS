import {
  priorizarDecisiones,
} from "./utils/priorizarDecisiones";

import {
  generarReglasComerciales,
} from "./reglas/reglasComerciales";

import {
  generarReglasFinancieras,
} from "./reglas/reglasFinancieras";

import {
  generarReglasInventario,
} from "./reglas/reglasInventario";

import {
  generarReglasDireccionGeneral,
} from "./reglas/reglasDireccionGeneral";

function crearDecision({
  id,
  tipo,
  nivel,
  titulo,
  mensaje,
  recomendacion,
  origen,
}) {
  return {
    id,
    tipo,
    nivel,
    titulo,
    mensaje,
    recomendacion,
    origen,
  };
}

function generarDecisionesIA({
  datosDashboard,
  movimientos = [],
}) {
  const decisiones = [];
  const metricas = datosDashboard?.metricas;

  if (!metricas) {
    return generarReglasDireccionGeneral({
      metricas,
      decisionesActuales: decisiones,
      crearDecision,
    });
  }

  const decisionesComerciales =
    generarReglasComerciales({
      metricas,
      crearDecision,
    });

  decisiones.push(...decisionesComerciales);

  const decisionesInventario =
    generarReglasInventario({
      metricas,
      crearDecision,
    });

  decisiones.push(...decisionesInventario);

  const decisionesFinancieras =
    generarReglasFinancieras({
      movimientos,
      crearDecision,
    });

  decisiones.push(...decisionesFinancieras);

  const decisionesDireccionGeneral =
    generarReglasDireccionGeneral({
      metricas,
      decisionesActuales: decisiones,
      crearDecision,
    });

  decisiones.push(...decisionesDireccionGeneral);

  return priorizarDecisiones(decisiones);
}

export {
  crearDecision,
  generarDecisionesIA,
};