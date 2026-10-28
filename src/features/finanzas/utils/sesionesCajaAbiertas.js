import { obtenerSesionesCajaActivas } from "../../inteligencia/utils/capturasFinancierasEquipo.js";

/** Reconstruye las sesiones abiertas por sucursal y caja usando el historial completo. */
export function resumirSesionesCajaAbiertas(cierres = []) {
  const porSucursal = new Map();
  for (const cierre of Array.isArray(cierres) ? cierres : []) {
    const branchId = String(cierre?.branch_id || "SIN_SUCURSAL");
    const historial = porSucursal.get(branchId) || [];
    historial.push(cierre);
    porSucursal.set(branchId, historial);
  }

  const sesiones = [];
  for (const [branchId, historial] of porSucursal) {
    for (const sesion of Object.values(obtenerSesionesCajaActivas(historial))) {
      sesiones.push({ ...sesion, branchId });
    }
  }
  return { cantidad: sesiones.length, sesiones };
}
