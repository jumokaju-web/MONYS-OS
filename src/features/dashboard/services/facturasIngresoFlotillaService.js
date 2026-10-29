import { supabase } from "../../../supabase";
import { consultarTodasLasPaginas } from "../../tesoreria/utils/paginarConsultaSupabase.js";

function fechaMexico(valor) {
  if (!valor) return null;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const fecha = new Date(`${valor}T12:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor ? valor : null;
  }
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(fecha);
  const parte = (tipo) => partes.find((item) => item.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export async function obtenerFacturasIngresoFlotillaPeriodo({ organizationId, desde, hasta, criterio = "servicio" }) {
  const inicio = fechaMexico(desde);
  const fin = fechaMexico(hasta);
  if (!organizationId || !inicio || !fin || inicio > fin) return { facturas: [], negocioEncontrado: false };
  if (!["servicio", "cobro", "servicio_o_cobro"].includes(criterio)) throw new Error("El criterio de fechas de Flotilla no es válido.");
  const diaSiguiente = new Date(`${fin}T12:00:00Z`);
  diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
  const cobroDesde = `${inicio}T00:00:00-06:00`;
  const cobroHasta = `${diaSiguiente.toISOString().slice(0, 10)}T00:00:00-06:00`;

  const { data: negocios, error: errorNegocios } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (errorNegocios) throw new Error(`No fue posible localizar Flotilla: ${errorNegocios.message}`);

  const candidatos = (negocios || []).filter((negocio) => /flotilla/i.test(negocio.name || ""));
  if (candidatos.length !== 1) return { facturas: [], negocioEncontrado: false };

  const data = await consultarTodasLasPaginas((primero, ultimo) => {
    let consulta = supabase
    .from("flotilla_facturas_ingreso")
    .select("id, organization_id, business_id, emisor, folio, periodo_desde, periodo_hasta, subtotal, iva, total, estado_pago, estado_conciliacion, pagada_en, cuenta_id, movimiento_tesoreria_id")
    .eq("organization_id", organizationId)
    .eq("business_id", candidatos[0].id)
    .neq("estado_pago", "CANCELADA");
    if (criterio === "servicio") consulta = consulta.lte("periodo_desde", fin).gte("periodo_hasta", inicio);
    else if (criterio === "cobro") consulta = consulta.eq("estado_pago", "PAGADA").gte("pagada_en", cobroDesde).lt("pagada_en", cobroHasta);
    else consulta = consulta.or(`and(periodo_desde.lte.${fin},periodo_hasta.gte.${inicio}),and(estado_pago.eq.PAGADA,pagada_en.gte.${cobroDesde},pagada_en.lt.${cobroHasta})`);
    return consulta.order("periodo_desde", { ascending: true }).order("id", { ascending: true }).range(primero, ultimo);
  });
  return { facturas: data || [], negocioEncontrado: true };
}
