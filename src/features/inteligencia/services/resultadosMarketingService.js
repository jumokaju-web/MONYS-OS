import { supabase } from "../../../supabase";

function numeroNoNegativo(valor, etiqueta, entero = false) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || (entero && !Number.isInteger(numero))) {
    throw new Error(`${etiqueta} debe ser un número válido igual o mayor que cero.`);
  }
  return numero;
}

export async function obtenerResultadosCampanas({ organizationId, limite = 50 } = {}) {
  if (!organizationId) return [];

  const { data, error } = await supabase
    .from("marketing_resultados_campana")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limite)));

  if (error) throw error;
  return data || [];
}

export async function registrarResultadoCampana({
  organizationId,
  publicacionId,
  periodoDesde,
  periodoHasta,
  alcance,
  interacciones,
  mensajes,
  pedidos,
  ventasAtribuidas,
  gastoReal,
  evidenciaReferencia,
  nota = "",
} = {}) {
  if (!organizationId || !publicacionId) throw new Error("Selecciona una campaña.");
  if (!periodoDesde || !periodoHasta || periodoHasta < periodoDesde) throw new Error("Revisa el periodo del resultado.");

  const evidencia = String(evidenciaReferencia || "").trim();
  if (evidencia.length < 5) throw new Error("Indica la captura, reporte o referencia que respalda el resultado.");

  const registro = {
    organization_id: organizationId,
    publicacion_id: publicacionId,
    periodo_desde: periodoDesde,
    periodo_hasta: periodoHasta,
    alcance: numeroNoNegativo(alcance, "El alcance", true),
    interacciones: numeroNoNegativo(interacciones, "Las interacciones", true),
    mensajes: numeroNoNegativo(mensajes, "Los mensajes", true),
    pedidos: numeroNoNegativo(pedidos, "Los pedidos", true),
    ventas_atribuidas: numeroNoNegativo(ventasAtribuidas, "Las ventas reportadas"),
    gasto_real: numeroNoNegativo(gastoReal, "La inversión reportada"),
    evidencia_referencia: evidencia,
    nota: String(nota || "").trim() || null,
    moneda: "MXN",
    fuente: "MANUAL",
    estado_verificacion: "REPORTADO",
  };

  const { data, error } = await supabase
    .from("marketing_resultados_campana")
    .insert(registro)
    .select()
    .single();

  if (error) throw error;
  return data;
}
