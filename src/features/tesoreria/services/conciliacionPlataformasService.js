import { supabase } from "../../../supabase";

const tablaInexistente = (error) => /42P01|PGRST205|does not exist|no existe|schema cache/i.test(`${error?.code || ""} ${error?.message || ""}`);
const COLUMNAS = "id, organization_id, business_id, cash_movement_id, cuenta_id, canal, tipo_operacion, referencia_externa, monto_conciliado, referencia_verificada, estado, verificado_en";

/*
 * Vínculos de plataforma de los movimientos indicados. null = la tabla
 * aún no existe (migración sin aplicar): nada se excluye.
 */
export async function obtenerVinculosPlataforma({ organizationId, businessId, movimientoIds = [] }) {
  if (!organizationId || !businessId) throw new Error("Falta la organización o el negocio activo.");
  const vinculos = [];
  for (let i = 0; i < movimientoIds.length; i += 100) {
    const { data, error } = await supabase.from("cash_movement_platform_links").select(COLUMNAS)
      .eq("organization_id", organizationId).eq("business_id", businessId).in("cash_movement_id", movimientoIds.slice(i, i + 100));
    if (error) {
      if (tablaInexistente(error)) return null;
      throw new Error(`No fue posible leer la conciliación de plataformas: ${error.message}`);
    }
    vinculos.push(...(data || []).filter((v) => String(v.organization_id) === String(organizationId) && String(v.business_id) === String(businessId)));
  }
  return vinculos;
}

/*
 * Propone un vínculo (estado "propuesto"). La verificación es un paso
 * aparte de una persona autorizada. La base valida negocio, cuenta,
 * monto acumulado y existencia de la referencia.
 */
export async function proponerVinculoPlataforma({ organizationId, businessId, cashMovementId, cuentaId, tipoOperacion, referenciaExterna = null, montoConciliado, evidencia = null }) {
  const { data, error } = await supabase.from("cash_movement_platform_links").insert({
    organization_id: organizationId, business_id: businessId, cash_movement_id: cashMovementId, cuenta_id: cuentaId,
    canal: "por_cuenta", tipo_operacion: tipoOperacion, referencia_externa: referenciaExterna, monto_conciliado: montoConciliado, evidencia,
  }).select(COLUMNAS).single();
  if (error) throw new Error(`No fue posible proponer el vínculo: ${error.message}`);
  return data;
}

export async function verificarVinculoPlataforma({ vinculoId, usuarioId }) {
  const { data, error } = await supabase.from("cash_movement_platform_links")
    .update({ estado: "verificado", verificado_por: usuarioId, verificado_en: new Date().toISOString() })
    .eq("id", vinculoId).select(COLUMNAS).single();
  if (error) throw new Error(`No fue posible verificar el vínculo: ${error.message}`);
  return data;
}
