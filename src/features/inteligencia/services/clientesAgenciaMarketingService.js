import { supabase } from "../../../supabase";

export async function obtenerClientesAgenciaMarketing({ organizationId } = {}) {
  if (!organizationId) {
    return [];
  }

  const { data, error } = await supabase
    .from("marketing_clientes_agencia")
    .select("id, business_id, nombre, tipo, sector, objetivo_principal, estado, presupuesto_mensual, moneda, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function crearClienteAgenciaMarketing({
  organizationId,
  nombre,
  sector,
  objetivoPrincipal,
} = {}) {
  const nombreLimpio = String(nombre || "").trim();
  const sectorLimpio = String(sector || "").trim();
  const objetivoLimpio = String(objetivoPrincipal || "").trim();

  if (!organizationId) {
    throw new Error("Falta identificar la agencia.");
  }

  if (nombreLimpio.length < 2) {
    throw new Error("Escribe el nombre del cliente o marca.");
  }

  if (objetivoLimpio.length < 5) {
    throw new Error("Describe brevemente qué quiere lograr el cliente.");
  }

  const { data, error } = await supabase
    .from("marketing_clientes_agencia")
    .insert({
      organization_id: organizationId,
      nombre: nombreLimpio,
      tipo: "EXTERNO",
      sector: sectorLimpio || null,
      objetivo_principal: objetivoLimpio,
      estado: "ACTIVO",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un cliente de agencia con ese nombre.");
    }
    throw error;
  }

  return data;
}

export async function cambiarEstadoClienteAgenciaMarketing({
  clienteId,
  estado,
} = {}) {
  const estadoNormalizado = String(estado || "").toUpperCase();

  if (!clienteId || !["ACTIVO", "PAUSADO"].includes(estadoNormalizado)) {
    throw new Error("No fue posible cambiar el estado del cliente.");
  }

  const { data, error } = await supabase
    .from("marketing_clientes_agencia")
    .update({ estado: estadoNormalizado, updated_at: new Date().toISOString() })
    .eq("id", clienteId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
