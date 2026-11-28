import { supabase } from "../../../supabase";
import { consultarTodasLasPaginas } from "../../tesoreria/utils/paginarConsultaSupabase.js";
import { conciliarGastosDelMes, expandirDistribuciones } from "../../../core/finanzas/conciliacionGastos.js";

const COLUMNAS_MOVIMIENTO =
  "id,organization_id,business_id,branch_id,movement_type,amount,concept,status,occurred_at,expense_category,expense_behavior";
const COLUMNAS_PARTIDA =
  "id,cash_movement_id,organization_id,business_id,branch_id,amount,expense_category,expense_behavior,status";

function rangoDelMes(mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ""))) throw new Error("Mes inválido para la conciliación.");
  const [ano, numeroMes] = mes.split("-").map(Number);
  // Un día de margen por la diferencia UTC / Ciudad de México; la
  // conciliación filtra por la fecha local.
  return {
    desde: new Date(Date.UTC(ano, numeroMes - 1, 1) - 86400000).toISOString(),
    hasta: new Date(Date.UTC(ano, numeroMes, 1) + 86400000).toISOString(),
  };
}

/*
 * Movimientos del mes del negocio y sus distribuciones activas, más las
 * partidas del negocio sobre movimientos registrados en otro negocio.
 */
export async function obtenerMovimientosDelMes({ organizationId, businessId, mes }) {
  if (!organizationId || !businessId) throw new Error("Falta el negocio para consultar sus movimientos.");
  const { desde, hasta } = rangoDelMes(mes);

  const movimientos = await consultarTodasLasPaginas((inicio, fin) =>
    supabase
      .from("cash_movements")
      .select(COLUMNAS_MOVIMIENTO)
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .gte("occurred_at", desde)
      .lt("occurred_at", hasta)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, fin)
  );

  const idsPropios = movimientos.map((movimiento) => movimiento.id);
  const partidasDeMovimientos = [];
  for (let i = 0; i < idsPropios.length; i += 200) {
    const lote = idsPropios.slice(i, i + 200);
    const { data, error } = await supabase
      .from("cash_movement_allocations")
      .select(COLUMNAS_PARTIDA)
      .in("cash_movement_id", lote)
      .eq("status", "ACTIVA");
    if (error) throw new Error(`No fue posible consultar distribuciones: ${error.message}`);
    partidasDeMovimientos.push(...(data || []));
  }

  const partidasDelNegocio = await consultarTodasLasPaginas((inicio, fin) =>
    supabase
      .from("cash_movement_allocations")
      .select(COLUMNAS_PARTIDA)
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVA")
      .order("id", { ascending: true })
      .range(inicio, fin)
  );

  const propios = new Set(idsPropios.map(String));
  const idsAjenos = [...new Set(partidasDelNegocio.map((p) => String(p.cash_movement_id)))].filter((id) => !propios.has(id));
  const movimientosOrigen = [];
  for (let i = 0; i < idsAjenos.length; i += 200) {
    const { data, error } = await supabase
      .from("cash_movements")
      .select(COLUMNAS_MOVIMIENTO)
      .eq("organization_id", organizationId)
      .in("id", idsAjenos.slice(i, i + 200))
      .gte("occurred_at", desde)
      .lt("occurred_at", hasta);
    if (error) throw new Error(`No fue posible consultar movimientos de origen: ${error.message}`);
    movimientosOrigen.push(...(data || []));
  }

  const porId = new Map();
  for (const partida of [...partidasDeMovimientos, ...partidasDelNegocio]) porId.set(String(partida.id), partida);
  return { movimientos, distribuciones: [...porId.values()], movimientosOrigen };
}

export function conciliarMovimientosDelNegocio({
  organizationId,
  businessId,
  movimientos = [],
  distribuciones = [],
  movimientosOrigen = [],
  obligaciones = [],
  mes,
  gastosFijos = null,
}) {
  const deLaOrganizacion = (fila) => String(fila?.organization_id) === String(organizationId);
  const deElNegocio = (fila) => deLaOrganizacion(fila) && String(fila?.business_id) === String(businessId);
  const movimientosValidos = (movimientos || []).filter(deElNegocio);
  const { lineas, pagosCruzados, partidasSinMovimiento } = expandirDistribuciones({
    movimientos: movimientosValidos,
    distribuciones: (distribuciones || []).filter(deLaOrganizacion),
    movimientosOrigen: (movimientosOrigen || []).filter(deLaOrganizacion),
    businessId,
  });
  return {
    ...conciliarGastosDelMes({ movimientos: lineas.filter(deElNegocio), obligaciones: (obligaciones || []).filter(deElNegocio), mes, gastosFijos }),
    pagosCruzados,
    partidasSinMovimiento,
    descartados: (movimientos || []).length - movimientosValidos.length,
  };
}
