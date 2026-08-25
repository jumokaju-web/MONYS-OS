import { supabase } from "../../../supabase";


export async function obtenerUltimoAnalisisPatrones({
  branchId = null,
} = {}) {
  let consulta =
    supabase
      .from(
        "cierres_patrones_analisis"
      )
      .select(`
        id,
        branch_id,
        periodo_dias,
        total_cierres,
        prioridad_general,
        resumen_ejecutivo,
        patrones_repetidos,
        productos_recurrentes,
        incidencias_recurrentes,
        objeciones_recurrentes,
        oportunidades_recurrentes,
        acciones_prioritarias,
        alertas,
        confianza,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1);


  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  }


  const {
    data,
    error,
  } = await consulta;


  if (error) {
    console.error(
      "Error al obtener último análisis de patrones:",
      error
    );

    throw error;
  }


  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return null;
  }


  return data[0];
}


export function convertirPatronesEnPrioridades(
  analisis
) {
  if (!analisis) {
    return [];
  }


  const prioridades = [];


  const prioridadGeneral =
    String(
      analisis.prioridad_general ||
        "normal"
    ).toLowerCase();


  const confianza =
    Number(
      analisis.confianza || 0
    );


  const nivelBase =
    prioridadGeneral === "urgente"
      ? "URGENTE"
      : prioridadGeneral === "alta"
      ? "ALTA"
      : prioridadGeneral === "baja"
      ? "BAJA"
      : "NORMAL";


  const acciones =
    Array.isArray(
      analisis.acciones_prioritarias
    )
      ? analisis.acciones_prioritarias
      : [];


  const alertas =
    Array.isArray(
      analisis.alertas
    )
      ? analisis.alertas
      : [];


  const patrones =
    Array.isArray(
      analisis.patrones_repetidos
    )
      ? analisis.patrones_repetidos
      : [];


  acciones.forEach(
    (
      accion,
      index
    ) => {
      prioridades.push({
        id:
          `patron-accion-${analisis.id}-${index}`,

        origen:
          "PATRONES_CIERRES",

        tipo:
          "ACCION_PRIORITARIA",

        titulo:
          accion,

        descripcion:
          analisis.resumen_ejecutivo ||
          "Acción detectada a partir de patrones operativos.",

        prioridad:
          nivelBase,

        confianza,

        requiereAtencion:
          prioridadGeneral === "alta" ||
          prioridadGeneral === "urgente",

        createdAt:
          analisis.created_at,
      });
    }
  );


  alertas.forEach(
    (
      alerta,
      index
    ) => {
      prioridades.push({
        id:
          `patron-alerta-${analisis.id}-${index}`,

        origen:
          "PATRONES_CIERRES",

        tipo:
          "ALERTA",

        titulo:
          alerta,

        descripcion:
          "Alerta detectada por repetición de señales en cierres de turno.",

        prioridad:
          prioridadGeneral === "baja"
            ? "NORMAL"
            : nivelBase,

        confianza,

        requiereAtencion:
          true,

        createdAt:
          analisis.created_at,
      });
    }
  );


  if (
    prioridades.length === 0 &&
    patrones.length > 0
  ) {
    patrones.forEach(
      (
        patron,
        index
      ) => {
        prioridades.push({
          id:
            `patron-repetido-${analisis.id}-${index}`,

          origen:
            "PATRONES_CIERRES",

          tipo:
            "PATRON_REPETIDO",

          titulo:
            patron,

          descripcion:
            analisis.resumen_ejecutivo ||
            "Patrón operativo repetido detectado por MONYS.",

          prioridad:
            nivelBase,

          confianza,

          requiereAtencion:
            prioridadGeneral === "alta" ||
            prioridadGeneral === "urgente",

          createdAt:
            analisis.created_at,
        });
      }
    );
  }


  return prioridades;
}


export async function obtenerPrioridadesDesdePatrones({
  branchId = null,
} = {}) {
  const analisis =
    await obtenerUltimoAnalisisPatrones({
      branchId,
    });


  if (!analisis) {
    return [];
  }


  return convertirPatronesEnPrioridades(
    analisis
  );
}