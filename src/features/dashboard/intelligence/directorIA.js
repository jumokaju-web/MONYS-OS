/*
=========================================================
MONYS ERP AI
Director General IA
=========================================================

Este módulo coordina todos los analizadores
especializados del sistema.

Cada analizador tiene una única responsabilidad.

Ejemplo:

✓ ventasAnalyzer
✓ inventarioAnalyzer
✓ comprasAnalyzer
✓ finanzasAnalyzer
✓ tesoreriaAnalyzer
✓ clientesAnalyzer

El Director IA reúne todos los análisis y
devuelve un único resumen para el Dashboard.
*/

import { analizarVentas } from "./ventasAnalyzer";
import { analizarInventario } from "../../inteligencia/analyzers/inventarioAnalyzer";
import { analizarFinanzas } from "./finanzasAnalyzer"

/*
=========================================================
Genera el resumen ejecutivo del negocio.
=========================================================
*/
export function generarResumenDirectorIA(
  datosDashboard
) {
  const resumenGeneral = [];

  /*
  ==========================================
  Ventas
  ==========================================
  */

  const ventas = analizarVentas(datosDashboard);

  if (ventas?.resumen?.length) {
    resumenGeneral.push(...ventas.resumen);
  }

  const finanzas = analizarFinanzas(datosDashboard);

if (finanzas?.resumen?.length) {
  resumenGeneral.push(...finanzas.resumen);
}

  /*
==========================================
Inventario
==========================================
*/

const inventario = analizarInventario(
  datosDashboard?.inventario?.detalles || []
);

if (inventario?.alertas?.length) {
  inventario.alertas.forEach((alerta) => {
    resumenGeneral.push({
      prioridad:
        alerta.prioridad === "critica"
          ? "alta"
          : "media",
      titulo: "Inventario",
      mensaje: alerta.mensaje,
    });
  });
}

  const prioridad = {
    alta: 1,
    media: 2,
    baja: 3,
  };

  resumenGeneral.sort(
    (a, b) =>
      (prioridad[a.prioridad] || 99) -
      (prioridad[b.prioridad] || 99)
  );

  return resumenGeneral;
}