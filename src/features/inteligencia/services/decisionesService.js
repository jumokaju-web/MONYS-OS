import { supabase } from "../../../supabase";

export async function obtenerHistorialDecisiones({
  limite = 20,
  importacionId = null,
} = {}) {
  let consulta = supabase
    .from("decisiones_ejecutivas")
    .select("*");

  if (importacionId) {
    consulta = consulta.eq(
      "importacion_id",
      importacionId
    );
  }

  const { data, error } =
    await consulta
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

export async function guardarDecisionPospuesta(
  decision,
  {
    autorizadoPor = "Jefa",
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
      "Decisión ejecutiva pospuesta",

    estado: "POSPUESTA",

    autorizadoPor,

    importacionId,
  });
}

export async function actualizarEjecucionDecision({
  decisionId,
  estadoEjecucion,
  resultadoEjecucion = null,
}) {
  if (!decisionId) {
    throw new Error(
      "Falta el ID de la decisión."
    );
  }

  const cambios = {
    estado_ejecucion:
      estadoEjecucion,
  };

  if (
    estadoEjecucion ===
    "EN_PROCESO"
  ) {
    cambios.fecha_inicio_ejecucion =
      new Date().toISOString();
  }

  if (
    estadoEjecucion ===
    "COMPLETADA"
  ) {
    cambios.fecha_completada =
      new Date().toISOString();

    cambios.resultado_ejecucion =
      resultadoEjecucion || null;
  }

  const { data, error } =
    await supabase
      .from("decisiones_ejecutivas")
      .update(cambios)
      .eq("id", decisionId)
      .select()
      .single();

  if (error) {
    throw new Error(
      `No se pudo actualizar la ejecución: ${error.message}`
    );
  }

  return data;
}