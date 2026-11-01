import { supabase } from "../../../supabase";

const POLITICA_INICIAL = {
  moneda: "MXN",
  publicarOrganicoAutomatico: true,
  publicarPagadoAutomatico: false,
  limitePorCampana: 0,
  limiteDiario: 0,
};

function normalizarPolitica(registro) {
  if (!registro) {
    return { ...POLITICA_INICIAL };
  }

  return {
    moneda: registro.moneda || "MXN",
    publicarOrganicoAutomatico:
      registro.publicar_organico_automatico === true,
    publicarPagadoAutomatico:
      registro.publicar_pagado_automatico === true,
    limitePorCampana: Number(registro.limite_por_campana || 0),
    limiteDiario: Number(registro.limite_diario || 0),
  };
}

export async function obtenerConfiguracionAutomatizacionMarketing({
  organizationId,
  businessId,
} = {}) {
  if (!organizationId || !businessId) {
    return {
      politica: { ...POLITICA_INICIAL },
      conexiones: [],
    };
  }

  const [politicaResultado, conexionesResultado] = await Promise.all([
    supabase
      .from("marketing_politicas_publicacion")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("marketing_cuentas_canal")
      .select(
        "id, cliente_agencia_id, proveedor, nombre_cuenta, estado, capacidades, ultima_sincronizacion, ultimo_error, solicitada_por, solicitada_en"
      )
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .order("proveedor", { ascending: true }),
  ]);

  if (politicaResultado.error) {
    throw politicaResultado.error;
  }

  if (conexionesResultado.error) {
    throw conexionesResultado.error;
  }

  return {
    politica: normalizarPolitica(politicaResultado.data),
    conexiones: conexionesResultado.data || [],
  };
}

export async function guardarPoliticaAutomatizacionMarketing({
  organizationId,
  businessId,
  politica,
} = {}) {
  if (!organizationId || !businessId) {
    throw new Error("Falta identificar el negocio.");
  }

  const limitePorCampana = Number(politica?.limitePorCampana || 0);
  const limiteDiario = Number(politica?.limiteDiario || 0);

  if (limitePorCampana < 0 || limiteDiario < 0) {
    throw new Error("Los límites de presupuesto no pueden ser negativos.");
  }

  const { data, error } = await supabase
    .from("marketing_politicas_publicacion")
    .upsert(
      {
        organization_id: organizationId,
        business_id: businessId,
        moneda: politica?.moneda || "MXN",
        publicar_organico_automatico:
          politica?.publicarOrganicoAutomatico === true,
        publicar_pagado_automatico:
          politica?.publicarPagadoAutomatico === true,
        limite_por_campana: limitePorCampana,
        limite_diario: limiteDiario,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,business_id" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return normalizarPolitica(data);
}

export const politicaInicialMarketing = POLITICA_INICIAL;

export async function prepararConexionMarketing({
  organizationId,
  businessId,
  clienteAgenciaId,
  proveedor,
} = {}) {
  const proveedorNormalizado = String(proveedor || "").toUpperCase();
  const proveedoresPermitidos = ["META", "TIKTOK", "TIKTOK_SHOP", "WHATSAPP", "MERCADO_LIBRE"];

  if (!organizationId || !businessId || !clienteAgenciaId) {
    throw new Error("Selecciona el negocio o cliente que autorizará la conexión.");
  }
  if (!proveedoresPermitidos.includes(proveedorNormalizado)) {
    throw new Error("El canal seleccionado no es válido.");
  }

  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion || !sesion?.user?.id) {
    throw new Error("Tu sesión no está disponible. Vuelve a entrar antes de preparar la conexión.");
  }

  const { data, error } = await supabase
    .from("marketing_cuentas_canal")
    .insert({
      organization_id: organizationId,
      business_id: businessId,
      cliente_agencia_id: clienteAgenciaId,
      proveedor: proveedorNormalizado,
      estado: "PENDIENTE",
      solicitada_por: sesion.user.id,
      solicitada_en: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este canal ya está preparado para el cliente seleccionado.");
    }
    throw error;
  }

  return data;
}
