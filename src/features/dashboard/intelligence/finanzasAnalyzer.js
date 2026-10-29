// ======================================================
// MONYS OS
// Adaptador financiero para el Director General IA
// ======================================================

import {
  analizarFinanzas as analizarFinanzasBase,
} from "../../inteligencia/shared/analizarFinanzas.js";

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
        "Registra entradas y salidas para que el Director Financiero pueda analizar el flujo del periodo. Confirma saldos y obligaciones antes de decidir compras.",
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
    titulo: "Indicador del flujo registrado",
    descripcion:
      `El indicador del flujo registrado es de ${analisis.saludFinanciera}%. No acredita disponibilidad ni solvencia. ` +
      analisis.recomendacion,
  });

  resumen.push({
    tipo: "capacidad-compra-pendiente",
    prioridad: "media",
    titulo: "Capacidad de compra por confirmar",
    descripcion: "Confirma saldos de bancos y cajas y las obligaciones próximas. El flujo positivo del periodo no autoriza nuevas compras.",
  });

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