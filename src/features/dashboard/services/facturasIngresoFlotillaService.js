import { supabase } from "../../../supabase";

function fechaMexico(valor) {
  if (!valor) return null;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(fecha);
  const parte = (tipo) => partes.find((item) => item.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export async function obtenerFacturasIngresoFlotillaPeriodo({ organizationId, desde, hasta }) {
  const inicio = fechaMexico(desde);
  const fin = fechaMexico(hasta);
  if (!organizationId || !inicio || !fin || inicio > fin) return { facturas: [], negocioEncontrado: false };

  const { data: negocios, error: errorNegocios } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (errorNegocios) throw new Error(`No fue posible localizar Flotilla: ${errorNegocios.message}`);

  const candidatos = (negocios || []).filter((negocio) => /flotilla/i.test(negocio.name || ""));
  if (candidatos.length !== 1) return { facturas: [], negocioEncontrado: false };

  const { data, error } = await supabase
    .from("flotilla_facturas_ingreso")
    .select("id, emisor, folio, periodo_desde, periodo_hasta, subtotal, iva, total, estado_pago, estado_conciliacion, pagada_en")
    .eq("organization_id", organizationId)
    .eq("business_id", candidatos[0].id)
    .neq("estado_pago", "CANCELADA")
    .lte("periodo_desde", fin)
    .gte("periodo_hasta", inicio)
    .order("periodo_desde", { ascending: true });
  if (error) throw new Error(`No fue posible cargar las facturas de Flotilla: ${error.message}`);
  return { facturas: data || [], negocioEncontrado: true };
}
