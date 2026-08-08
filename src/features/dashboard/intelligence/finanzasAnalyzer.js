// ======================================================
// MONYS OS
// Adaptador financiero para el Director General IA
// ======================================================

import {
  analizarFinanzas as analizarFinanzasBase,
} from "../../inteligencia/shared/analizarFinanzas";

export function analizarFinanzas(
  datosDashboard = {}
) {
  const analisis =
    analizarFinanzasBase(datosDashboard);

  const resumen = [];

  if (
    analisis.totalEntradas === 0 &&
    analisis.totalSalidas === 0
  ) {
    resumen.push({
      tipo: "finanzas-sin-datos",
      prioridad: "media",
      titulo: "Finanzas",
      descripcion:
        "Registra entradas y salidas para que el Director Financiero pueda evaluar la liquidez real.",
    });

    return {
      ...analisis,
      resumen,
    };
  }

  resumen.push({
    tipo: "salud-financiera",
    prioridad:
      analisis.nivelRiesgo.nivel === "critico" ||
      analisis.nivelRiesgo.nivel === "alto"
        ? "alta"
        : analisis.nivelRiesgo.nivel === "medio"
          ? "media"
          : "baja",
    titulo: "Salud financiera",
    descripcion:
      `La salud financiera es de ${analisis.saludFinanciera}%. ` +
      analisis.recomendacion,
  });

  if (analisis.balance > 0) {
    resumen.push({
      tipo: "capacidad-compra",
      prioridad: "baja",
      titulo: "Capacidad de compra",
      descripcion:
        `El Director Financiero estima una capacidad prudente de compra de hasta $${analisis.capacidadCompra.toLocaleString(
          "es-MX"
        )} MXN.`,
    });
  }

  if (analisis.balance < 0) {
    resumen.push({
      tipo: "flujo-negativo",
      prioridad: "alta",
      titulo: "Alerta de flujo",
      descripcion:
        "Las salidas superan a las entradas. Conviene detener compras no esenciales y revisar pagos.",
    });
  }

  return {
    ...analisis,
    resumen,
  };
}