import { generarResumenDirectorIA } from "../intelligence/directorIA";

/*
  Adaptador temporal entre el Dashboard y el nuevo
  Motor de Inteligencia de MONYS ERP AI.

  El Dashboard seguirá llamando a esta función,
  pero internamente ya utilizará el Director IA.

  Cuando todos los analizadores estén terminados,
  este archivo desaparecerá y el Dashboard hablará
  directamente con el Director IA.
*/

export function generarInsightsDashboard(
  datosDashboard
) {
  const resumen =
    generarResumenDirectorIA(datosDashboard);

  return resumen.map((item, index) => {
    let nivel = "INFO";
    let color = "#1976d2";
    let icono = "🔵";

    if (item.prioridad === "alta") {
      nivel = "ALTA";
      color = "#d32f2f";
      icono = "🔴";
    }

    if (item.prioridad === "media") {
      nivel = "MEDIA";
      color = "#f57c00";
      icono = "🟡";
    }

    if (item.prioridad === "baja") {
      nivel = "INFO";
      color = "#388e3c";
      icono = "🟢";
    }

    return {
      id: item.tipo ?? `insight-${index}`,
      prioridad: index + 1,
      nivel,
      color,
      tipo: item.prioridad,
      icono,
      titulo: item.titulo,
      mensaje: item.descripcion,
    };
  });
}