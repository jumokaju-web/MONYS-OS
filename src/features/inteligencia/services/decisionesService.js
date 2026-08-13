import { supabase } from "../../../supabase";

export async function obtenerHistorialDecisiones({
  limite = 20,
} = {}) {
  const { data, error } = await supabase
    .from("decisiones_ejecutivas")
    .select("*")
    .order("creado_en", {
      ascending: false,
    })
    .limit(limite);

  if (error) {
    throw new Error(
      `No se pudo cargar el historial de decisiones: ${error.message}`
    );
  }

  return data || [];
}

export async function guardarDecisionEjecutiva({
  tipoDecision,
  descripcion,
  estado,
  autorizadoPor = "Director General IA",
  importacionId = null,
}) {
  const registro = {
    tipo_decision:
      tipoDecision || "DECISION_EJECUTIVA",

    descripcion:
      descripcion ||
      "Decisión ejecutiva registrada",

    estado:
      estado || "REGISTRADA",

    autorizado_por:
      autorizadoPor,
  };

  if (importacionId) {
    registro.importacion_id =
      importacionId;
  }

  const { data, error } = await supabase
    .from("decisiones_ejecutivas")
    .insert([registro])
    .select()
    .single();

  if (error) {
    throw new Error(
      `No se pudo guardar la decisión: ${error.message}`
    );
  }

  return data;
}

export async function guardarDecisionAprobada(
  decision,
  {
    autorizadoPor =
      "Director General IA",
    importacionId = null,
  } = {}
) {
  return guardarDecisionEjecutiva({
    tipoDecision:
      decision?.tipo ||
      decision?.accion ||
      "DECISION_EJECUTIVA",

    descripcion:
      decision?.descripcion ||
      decision?.titulo ||
      "Decisión ejecutiva aprobada",

    estado: "APROBADA",

    autorizadoPor,

    importacionId,
  });
}

export async function guardarDecisionRechazada(
  decision,
  {
    autorizadoPor =
      "Director General IA",
    importacionId = null,
  } = {}
) {
  return guardarDecisionEjecutiva({
    tipoDecision:
      decision?.tipo ||
      decision?.accion ||
      "DECISION_EJECUTIVA",

    descripcion:
      decision?.descripcion ||
      decision?.titulo ||
      "Decisión ejecutiva rechazada",

    estado: "RECHAZADA",

    autorizadoPor,

    importacionId,
  });
}