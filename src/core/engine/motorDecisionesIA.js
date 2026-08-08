/**
 * =====================================================
 * MONYS OS
 * Motor Central de Decisiones IA
 * =====================================================
 *
 * Este archivo NO muestra información.
 *
 * Este archivo PIENSA.
 *
 * Analiza el estado actual de la empresa y genera
 * decisiones para todos los Directores IA.
 */

import { obtenerEmpresaActual } from "./empresaActual";

export function ejecutarMotorDecisiones() {
  const empresa = obtenerEmpresaActual();

  const decisiones = {
    general: [],
    financiero: [],
    comercial: [],
    inventario: [],
    logistica: [],
  };

  /* ==========================
     DIRECTOR FINANCIERO
  ========================== */

  if (empresa.finanzas.liquidez >= 80) {
    decisiones.financiero.push({
      prioridad: "MEDIA",
      titulo: "Liquidez saludable",
      mensaje:
        "Existe capacidad para realizar compras de forma controlada.",
    });
  } else {
    decisiones.financiero.push({
      prioridad: "ALTA",
      titulo: "Proteger flujo",
      mensaje:
        "Se recomienda limitar compras hasta recuperar liquidez.",
    });
  }

  /* ==========================
     DIRECTOR COMERCIAL
  ========================== */

  if (
    empresa.ventas.productosVendidos.length > 0
  ) {
    decisiones.comercial.push({
      prioridad: "ALTA",
      titulo: "Analizar productos estrella",
      mensaje:
        "Ya existen ventas suficientes para comenzar recomendaciones de compra.",
    });
  }

  /* ==========================
     INVENTARIO
  ========================== */

  if (
    empresa.inventario.agotados.length > 0
  ) {
    decisiones.inventario.push({
      prioridad: "ALTA",
      titulo: "Productos agotados",
      mensaje:
        `${empresa.inventario.agotados.length} productos requieren resurtido.`,
    });
  }

  /* ==========================
     DIRECTOR GENERAL
  ========================== */

  let mensajeGeneral =
    "La empresa continúa operando normalmente.";

  if (
    decisiones.financiero.length +
      decisiones.comercial.length +
      decisiones.inventario.length >
    0
  ) {
    mensajeGeneral =
      "Se detectaron oportunidades de mejora que requieren atención.";
  }

  decisiones.general.push({
    prioridad: "ALTA",
    titulo: "Resumen Ejecutivo",
    mensaje: mensajeGeneral,
  });

  return decisiones;
}