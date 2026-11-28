import { supabase } from "../../../supabase";
import { consultarTodasLasPaginas } from "../../tesoreria/utils/paginarConsultaSupabase.js";
import { conciliarGastosDelMes } from "../../../core/finanzas/conciliacionGastos.js";

/*
 * Movimientos de caja de un mes del negocio activo (incluye un día de
 * margen a cada lado por la diferencia UTC / Ciudad de México; la
 * conciliación filtra por la fecha local).
 */
export async function obtenerMovimientosDelMes({ organizationId, businessId, mes }) {
  if (!organizationId || !businessId) throw new Error("Falta el negocio para consultar sus movimientos.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ""))) throw new Error("Mes inválido para la conciliación.");
  const [ano, numeroMes] = mes.split("-").map(Number);
  const desde = new Date(Date.UTC(ano, numeroMes - 1, 1) - 86400000).toISOString();
  const hasta = new Date(Date.UTC(ano, numeroMes, 1) + 86400000).toISOString();

  return consultarTodasLasPaginas((inicio, fin) =>
    supabase
      .from("cash_movements")
      .select("id,organization_id,business_id,branch_id,movement_type,amount,concept,status,occurred_at,expense_category,expense_behavior")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .gte("occurred_at", desde)
      .lt("occurred_at", hasta)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, fin)
  );
}

export function conciliarMovimientosDelNegocio({ organizationId, businessId, movimientos = [], obligaciones = [], mes, gastosFijos = null }) {
  const deElNegocio = (fila) =>
    String(fila?.organization_id) === String(organizationId) && String(fila?.business_id) === String(businessId);
  const validos = (movimientos || []).filter(deElNegocio);
  return {
    ...conciliarGastosDelMes({ movimientos: validos, obligaciones: (obligaciones || []).filter(deElNegocio), mes, gastosFijos }),
    descartados: (movimientos || []).length - validos.length,
  };
}
