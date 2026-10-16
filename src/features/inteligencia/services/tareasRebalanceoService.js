import {
  generarRecomendacionesRebalanceo,
} from "../../inventario/services/rebalanceoInventarioService";

import {
  crearTareaAutomaticaDesdePrioridad,
} from "./tareasOperativasService";
import { construirVerificacionesTraspaso } from "../../inventario/shared/revisionTraspaso";


// ======================================================
// MONYS OS
// REBALANCEO → TAREAS OPERATIVAS
//
// Convierte recomendaciones ALTA en verificaciones físicas por sucursal.
//
// Asigna como máximo dos revisiones por sucursal: una para confirmar
// posible sobrante y otra para confirmar posible faltante.
// NO ejecuta el traspaso.
// ======================================================

export async function crearTareasPrioritariasRebalanceo({
  maximoPorSucursal = 2,
  organizationId = null,
  businessId = null,
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
      );

  const verificaciones = construirVerificacionesTraspaso(altas, {
    maximoPorSucursal,
  });

  const resultados = [];


  for (const verificacion of verificaciones) {
    const { recomendacion } = verificacion;
    try {
      const descripcion = `${verificacion.descripcion} MONYS sugiere ${recomendacion.cantidadSugerida} piezas para el posible traspaso ${recomendacion.sucursalOrigen} → ${recomendacion.sucursalDestino}. No muevas producto ni actualices inventario desde esta tarea.`;


      const prioridad = {
        id:
          `rebalanceo-${recomendacion.productId}-${recomendacion.branchOrigenId}-${recomendacion.branchDestinoId}`,

        titulo: verificacion.titulo,

        descripcion,

        prioridad:
          "ALTA",

        impacto:
          "ALTO",

        origen:
          "REBALANCEO_INVENTARIO",

        origenTexto:
          "Rebalanceo inteligente",

        area:
          "inventario",

        responsable: "Inventario",

        requiereAtencion:
          true,

        requiereEvidencia: false,

        instrucciones:
          verificacion.instrucciones,

        criterioExito:
          "Captura el conteo físico explícito y decide si hay sobrante/faltante, si no se confirma o si debe ajustarse la cantidad. Dirección revisará ambas sucursales antes de autorizar cualquier movimiento.",

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
            verificacion.branchId,

          organizationId,

          businessId,

          creadaPor:
            "MONYS OS",
        });


      resultados.push({
        producto:
          recomendacion.producto,

        lado:
          verificacion.lado,

        sucursal:
          verificacion.lado === "ORIGEN"
            ? recomendacion.sucursalOrigen
            : recomendacion.sucursalDestino,

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
      verificaciones.length,

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
