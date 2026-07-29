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

  /*
  ==========================================
  Futuros analizadores
  ==========================================

  const inventario = analizarInventario(...);
  resumenGeneral.push(...inventario.resumen);

  const compras = analizarCompras(...);
  resumenGeneral.push(...compras.resumen);

  const finanzas = analizarFinanzas(...);
  resumenGeneral.push(...finanzas.resumen);
  */

  /*
  ==========================================
  Orden por prioridad
  ==========================================
  */

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