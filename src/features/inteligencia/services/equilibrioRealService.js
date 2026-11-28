import { obtenerObligacionesOperativas } from "./obligacionesOperativasService";
import { obtenerDeudasFinancieras } from "./deudasFinancierasService";
import { obtenerSucursalesInventario } from "../../inventario/services/inventarioService";
import { obtenerUltimasVentasPorSucursal } from "../../dashboard/services/dashboardDataService";
import { construirEquilibrioReal, gastosFijosDelMes } from "../../../core/finanzas/equilibrioReal.js";
import { conciliarMovimientosDelNegocio, obtenerMovimientosDelMes } from "./conciliacionGastosService.js";

/*
 * Punto de equilibrio del negocio activo con datos reales.
 * Sin organizationId o businessId no consulta nada. Comprueba que cada
 * fuente pertenezca al negocio antes de calcular (aislamiento).
 */
export async function obtenerEquilibrioReal({
  organizationId = null,
  businessId = null,
  mes,
  diasAbiertos = null,
  diasAbiertosMes = {},
  diasAbiertosPeriodo = {},
  variablePorcentaje = null,
  sinDeudasConfirmado = false,
} = {}) {
  if (!organizationId || !businessId) {
    return {
      estado: "sin_contexto",
      motivo: !organizationId ? "Falta identificar la organización activa." : "Falta identificar el negocio activo.",
      calculable: false,
      datos: null,
      faltantes: [],
    };
  }

  const sucursales = (await obtenerSucursalesInventario(businessId)).filter(
    (sucursal) => String(sucursal?.business_id) === String(businessId)
  );
  const branchIds = sucursales.map((sucursal) => sucursal.id);

  const [obligaciones, deudas, ventas, movimientos] = await Promise.all([
    obtenerObligacionesOperativas({ organizationId, businessId }),
    obtenerDeudasFinancieras({ organizationId, businessId }),
    branchIds.length ? obtenerUltimasVentasPorSucursal(branchIds) : Promise.resolve([]),
    // Sin movimientos legibles, el equilibrio sigue pero con confianza baja.
    obtenerMovimientosDelMes({ organizationId, businessId, mes }).catch((error) => ({ error })),
  ]);

  const deElNegocio = (fila) =>
    String(fila?.organization_id) === String(organizationId) && String(fila?.business_id) === String(businessId);
  const sucursalesSet = new Set(branchIds.map(String));
  const obligacionesValidas = (obligaciones || []).filter(deElNegocio);
  const deudasValidas = (deudas || []).filter(deElNegocio);
  const ventasValidas = (ventas || []).filter((item) => sucursalesSet.has(String(item?.branch_id)));
  const descartados =
    (obligaciones || []).length - obligacionesValidas.length +
    ((deudas || []).length - deudasValidas.length) +
    ((ventas || []).length - ventasValidas.length);

  const lecturaCaja = movimientos && !movimientos.error ? movimientos : null;
  const conciliacion = lecturaCaja
    ? conciliarMovimientosDelNegocio({
        organizationId,
        businessId,
        movimientos: lecturaCaja.movimientos,
        distribuciones: lecturaCaja.distribuciones,
        movimientosOrigen: lecturaCaja.movimientosOrigen,
        obligaciones: obligacionesValidas,
        mes,
        gastosFijos: gastosFijosDelMes(obligacionesValidas, mes),
      })
    : null;

  const totalDescartados = descartados + (conciliacion?.descartados || 0);

  return {
    estado: "listo",
    motivo: "",
    errores: lecturaCaja ? [] : [`Movimientos de caja: ${movimientos?.error?.message || "no disponibles"}`],
    descartados: totalDescartados,
    conciliacion,
    ...construirEquilibrioReal({
      businessId,
      mes,
      obligaciones: obligacionesValidas,
      deudas: deudasValidas,
      sinDeudasConfirmado,
      ventasPorSucursal: ventasValidas,
      sucursales,
      diasAbiertos,
      diasAbiertosMes,
      diasAbiertosPeriodo,
      variablePorcentaje,
      conciliacion,
      descartados: totalDescartados,
    }),
  };
}
