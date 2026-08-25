import {
  ejecutarAnalisisInventarioAutomatico,
  convertirHallazgosInventarioEnPrioridades,
} from "../services/inventarioAutomaticoService";


// ======================================================
// MONYS OS
// DIRECTOR DE INVENTARIO IA
//
// Convierte el análisis técnico de inventario en:
// - estado general
// - riesgos
// - prioridades
// - acciones recomendadas
// - resumen ejecutivo
// ======================================================


function calcularNivelInventario({
  totalNegativos = 0,
  totalFaltantes = 0,
  totalSospechosos = 0,
  totalSobreinventario = 0,
}) {
  const riesgo =
    totalNegativos * 4 +
    totalFaltantes * 3 +
    totalSospechosos * 2 +
    totalSobreinventario;

  if (riesgo >= 20) {
    return "CRITICO";
  }

  if (riesgo >= 10) {
    return "ALTO";
  }

  if (riesgo >= 4) {
    return "MEDIO";
  }

  return "CONTROLADO";
}


function construirResumenEjecutivo({
  totalProductos,
  totalNegativos,
  totalFaltantes,
  totalSospechosos,
  totalSobreinventario,
  valorInventario,
}) {
  if (!totalProductos) {
    return "No hay inventario disponible para analizar en esta sucursal.";
  }

  if (
    totalNegativos === 0 &&
    totalFaltantes === 0 &&
    totalSospechosos === 0 &&
    totalSobreinventario === 0
  ) {
    return `MONYS analizó ${totalProductos} productos y no detectó alertas relevantes en esta revisión. El valor aproximado del inventario analizado es de $${Number(
      valorInventario || 0
    ).toFixed(2)}.`;
  }

  return `MONYS analizó ${totalProductos} productos. Detectó ${totalNegativos} inventarios negativos, ${totalFaltantes} faltantes con demanda, ${totalSospechosos} existencias sospechosas y ${totalSobreinventario} posibles casos de inventario sin movimiento. El valor aproximado del inventario analizado es de $${Number(
    valorInventario || 0
  ).toFixed(2)}.`;
}


function construirRiesgos({
  totalNegativos,
  totalFaltantes,
  totalSospechosos,
  totalSobreinventario,
}) {
  const riesgos = [];

  if (totalNegativos > 0) {
    riesgos.push({
      tipo: "INVENTARIO_NEGATIVO",
      titulo: "Existen inventarios negativos",
      descripcion:
        "Puede haber diferencias entre SICAR y el inventario físico, ventas mal descontadas o entradas no registradas.",
      prioridad: "alta",
    });
  }

  if (totalFaltantes > 0) {
    riesgos.push({
      tipo: "FALTANTES",
      titulo: "Hay productos con demanda y sin existencia",
      descripcion:
        "Existe riesgo directo de pérdida de ventas por productos que se están solicitando pero no están disponibles.",
      prioridad: "alta",
    });
  }

  if (totalSospechosos > 0) {
    riesgos.push({
      tipo: "INVENTARIO_SOSPECHOSO",
      titulo: "Hay existencias que requieren validación",
      descripcion:
        "Algunas cantidades son inusualmente altas y conviene confirmar que correspondan al inventario físico real.",
      prioridad: "media",
    });
  }

  if (totalSobreinventario > 0) {
    riesgos.push({
      tipo: "SOBREINVENTARIO",
      titulo: "Hay capital inmovilizado en inventario",
      descripcion:
        "Existen productos con valor relevante y sin movimiento registrado en el periodo analizado.",
      prioridad: "media",
    });
  }

  return riesgos;
}


function construirAcciones({
  totalNegativos,
  totalFaltantes,
  totalSospechosos,
  totalSobreinventario,
}) {
  const acciones = [];

  if (totalNegativos > 0) {
    acciones.push({
      titulo:
        "Realizar revisión física de inventarios negativos",
      responsable:
        "Operación",
      prioridad:
        "alta",
    });
  }

  if (totalFaltantes > 0) {
    acciones.push({
      titulo:
        "Revisar reposición o traspaso de productos faltantes",
      responsable:
        "Inventario",
      prioridad:
        "alta",
    });
  }

  if (totalSospechosos > 0) {
    acciones.push({
      titulo:
        "Validar existencias sospechosas contra inventario físico",
      responsable:
        "Operación",
      prioridad:
        "media",
    });
  }

  if (totalSobreinventario > 0) {
    acciones.push({
      titulo:
        "Evaluar traspasos, promociones o reducción de sobreinventario",
      responsable:
        "Inventario",
      prioridad:
        "media",
    });
  }

  return acciones;
}


// ======================================================
// FUNCIÓN PRINCIPAL
// ======================================================

export async function generarDirectorInventarioIA({
  branchId,
} = {}) {
  if (!branchId) {
    throw new Error(
      "Falta branch_id para ejecutar el Director de Inventario."
    );
  }

  const analisis =
    await ejecutarAnalisisInventarioAutomatico({
      branchId,
    });

  const prioridades =
    convertirHallazgosInventarioEnPrioridades(
      analisis.hallazgos
    );

  const nivel =
    calcularNivelInventario({
      totalNegativos:
        analisis.totalNegativos,

      totalFaltantes:
        analisis.totalFaltantes,

      totalSospechosos:
        analisis.totalSospechosos,

      totalSobreinventario:
        analisis.totalSobreinventario,
    });

  const resumenEjecutivo =
    construirResumenEjecutivo({
      totalProductos:
        analisis.totalProductos,

      totalNegativos:
        analisis.totalNegativos,

      totalFaltantes:
        analisis.totalFaltantes,

      totalSospechosos:
        analisis.totalSospechosos,

      totalSobreinventario:
        analisis.totalSobreinventario,

      valorInventario:
        analisis.valorInventario,
    });

  const riesgos =
    construirRiesgos({
      totalNegativos:
        analisis.totalNegativos,

      totalFaltantes:
        analisis.totalFaltantes,

      totalSospechosos:
        analisis.totalSospechosos,

      totalSobreinventario:
        analisis.totalSobreinventario,
    });

  const accionesRecomendadas =
    construirAcciones({
      totalNegativos:
        analisis.totalNegativos,

      totalFaltantes:
        analisis.totalFaltantes,

      totalSospechosos:
        analisis.totalSospechosos,

      totalSobreinventario:
        analisis.totalSobreinventario,
    });

  return {
    ok:
      true,

    branchId,

    nivel,

    resumenEjecutivo,

    indicadores: {
      totalProductos:
        analisis.totalProductos,

      totalHallazgos:
        analisis.totalHallazgos,

      negativos:
        analisis.totalNegativos,

      faltantes:
        analisis.totalFaltantes,

      sospechosos:
        analisis.totalSospechosos,

      sobreinventario:
        analisis.totalSobreinventario,

      valorInventario:
        analisis.valorInventario,
    },

    riesgos,

    accionesRecomendadas,

    prioridades,

    hallazgos:
      analisis.hallazgos,
  };
}