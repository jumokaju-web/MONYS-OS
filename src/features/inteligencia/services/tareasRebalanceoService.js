import {
  generarRecomendacionesRebalanceo,
} from "../../inventario/services/rebalanceoInventarioService";

import {
  crearTareaAutomaticaDesdePrioridad,
} from "./tareasOperativasService";


// ======================================================
// MONYS OS
// REBALANCEO → TAREAS OPERATIVAS
//
// Convierte únicamente recomendaciones ALTA
// en tareas concretas.
//
// NO ejecuta el traspaso.
// Solo prepara la acción para revisión/ejecución.
// ======================================================

export async function crearTareasPrioritariasRebalanceo({
  maximo = 3,
} = {}) {
  const recomendaciones =
    await generarRecomendacionesRebalanceo();

  const altas =
    (
      Array.isArray(recomendaciones)
        ? recomendaciones
        : []
    )
      .filter(
        (recomendacion) =>
          String(
            recomendacion?.prioridad ||
            ""
          ).toUpperCase() === "ALTA"
      )
      .slice(
        0,
        Math.max(
          1,
          Number(maximo) || 3
        )
      );


  const resultados = [];


  for (
    const recomendacion
    of altas
  ) {
    try {
      /*
        La tarea se asigna a la sucursal
        DE ORIGEN porque ahí está físicamente
        la mercancía que debe prepararse.
      */

      const titulo =
        `Preparar traspaso de ${recomendacion.producto}: ${recomendacion.cantidadSugerida} pzas de ${recomendacion.sucursalOrigen} a ${recomendacion.sucursalDestino}`;


      const descripcion =
        `${recomendacion.motivo} ` +
        `MONYS recomienda mover ${recomendacion.cantidadSugerida} piezas de ${recomendacion.sucursalOrigen} a ${recomendacion.sucursalDestino}. ` +
        `Antes de realizar el movimiento se debe confirmar físicamente la existencia disponible.`;


      const prioridad = {
        id:
          `rebalanceo-${recomendacion.productId}-${recomendacion.branchOrigenId}-${recomendacion.branchDestinoId}`,

        titulo,

        descripcion,

        prioridad:
          "ALTA",

        impacto:
          "ALTO",

        origen:
          "REBALANCEO_INVENTARIO",

        origenTexto:
          "Rebalanceo inteligente",

        responsable:
          "Inventario",

        confianza:
          90,

        requiereAtencion:
          true,

        metadata: {
          productId:
            recomendacion.productId,

          codigo:
            recomendacion.codigo,

          producto:
            recomendacion.producto,

          branchOrigenId:
            recomendacion.branchOrigenId,

          branchDestinoId:
            recomendacion.branchDestinoId,

          sucursalOrigen:
            recomendacion.sucursalOrigen,

          sucursalDestino:
            recomendacion.sucursalDestino,

          existenciaOrigen:
            recomendacion.existenciaOrigen,

          existenciaDestino:
            recomendacion.existenciaDestino,

          ventasOrigen:
            recomendacion.ventasOrigen,

          ventasDestino:
            recomendacion.ventasDestino,

          coberturaOrigen:
            recomendacion.coberturaOrigen,

          coberturaDestino:
            recomendacion.coberturaDestino,

          cantidadSugerida:
            recomendacion.cantidadSugerida,
        },
      };


      const resultado =
        await crearTareaAutomaticaDesdePrioridad({
          prioridad,

          branchId:
            recomendacion.branchOrigenId,

          creadaPor:
            "MONYS OS",
        });


      resultados.push({
        producto:
          recomendacion.producto,

        origen:
          recomendacion.sucursalOrigen,

        destino:
          recomendacion.sucursalDestino,

        cantidad:
          recomendacion.cantidadSugerida,

        ...resultado,
      });
    } catch (error) {
      console.error(
        "Error creando tarea de rebalanceo:",
        error
      );

      resultados.push({
        producto:
          recomendacion?.producto ||
          null,

        creada:
          false,

        motivo:
          "ERROR",

        error:
          error?.message ||
          "Error desconocido",
      });
    }
  }


  return {
    totalRecomendaciones:
      Array.isArray(recomendaciones)
        ? recomendaciones.length
        : 0,

    altasDetectadas:
      (
        Array.isArray(recomendaciones)
          ? recomendaciones
          : []
      ).filter(
        (item) =>
          String(
            item?.prioridad ||
            ""
          ).toUpperCase() ===
          "ALTA"
      ).length,

    revisadas:
      altas.length,

    creadas:
      resultados.filter(
        (item) =>
          item.creada === true
      ).length,

    duplicadas:
      resultados.filter(
        (item) =>
          item.motivo ===
          "DUPLICADA"
      ).length,

    errores:
      resultados.filter(
        (item) =>
          item.motivo ===
          "ERROR"
      ).length,

    resultados,
  };
}