import { ejecutarMotorDecisiones } from "./motorDecisionesIA";

export function obtenerDashboardData() {
  const decisiones = ejecutarMotorDecisiones();

  return {
    resumen: decisiones.general,

    alertas: [
      ...decisiones.financiero,
      ...decisiones.inventario,
    ],

    comerciales: decisiones.comercial,

    financiero: decisiones.financiero,

    inventario: decisiones.inventario,

    totalAlertas:
      decisiones.financiero.length +
      decisiones.inventario.length,

    totalDecisiones:
      decisiones.general.length +
      decisiones.financiero.length +
      decisiones.comercial.length +
      decisiones.inventario.length,
  };
}