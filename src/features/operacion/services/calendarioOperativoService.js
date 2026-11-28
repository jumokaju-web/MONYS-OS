import { supabase } from "../../../supabase";

const tablaInexistente = (error) => /42P01|PGRST205|does not exist|no existe|schema cache/i.test(`${error?.code || ""} ${error?.message || ""}`);

/*
 * Vigencias y días del calendario operativo del negocio en un rango.
 * Devuelve null si las tablas aún no existen (migración sin aplicar):
 * el consumidor debe tratarlo como "calendario no disponible", nunca como
 * "todos los días abiertos".
 */
export async function obtenerCalendarioOperativo({ organizationId, businessId, desde, hasta }) {
  if (!organizationId || !businessId) throw new Error("Falta la organización o el negocio activo.");
  const [vigencias, dias] = await Promise.all([
    supabase.from("sucursal_vigencias").select("branch_id, operando_desde, operando_hasta, organization_id, business_id")
      .eq("organization_id", organizationId).eq("business_id", businessId),
    supabase.from("sucursal_calendario").select("branch_id, fecha, estado, minutos_programados, minutos_reales, motivo, confirmado_en, organization_id, business_id")
      .eq("organization_id", organizationId).eq("business_id", businessId).gte("fecha", desde).lte("fecha", hasta),
  ]);
  for (const r of [vigencias, dias]) {
    if (r.error) {
      if (tablaInexistente(r.error)) return null;
      throw new Error(`No fue posible leer el calendario operativo: ${r.error.message}`);
    }
  }
  const propio = (f) => String(f.organization_id) === String(organizationId) && String(f.business_id) === String(businessId);
  return { vigencias: (vigencias.data || []).filter(propio), dias: (dias.data || []).filter(propio) };
}
