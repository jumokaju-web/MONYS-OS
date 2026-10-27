import { supabase } from "../../../supabase";

function hoyMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const tomar = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${tomar("year")}-${tomar("month")}-${tomar("day")}`;
}

export async function obtenerObligacionesOperativas({ organizationId, businessId }) {
  if (!organizationId || !businessId) throw new Error("Falta el negocio para consultar sus obligaciones.");
  const { data, error } = await supabase
    .from("obligaciones_operativas")
    .select("*, obligaciones_operativas_pagos(id, importe, cash_movement_id, created_at)")
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .order("fecha_vencimiento", { ascending: true });
  if (error) throw new Error(`No fue posible consultar obligaciones operativas: ${error.message}`);
  return data || [];
}

export async function obtenerControlObligacionesOperativas({ organizationId, businessId }) {
  const [obligaciones, revision] = await Promise.all([
    obtenerObligacionesOperativas({ organizationId, businessId }),
    supabase.from("revisiones_obligaciones_operativas")
      .select("id, fecha_revision, nota, confirmado_en")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .eq("fecha_revision", hoyMexico())
      .order("confirmado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (revision.error) throw new Error(`No fue posible consultar la revisión de cobertura: ${revision.error.message}`);
  const ultimaModificacion = obligaciones.flatMap((item) => [
    item.updated_at || item.created_at,
    ...(item.obligaciones_operativas_pagos || []).map((pago) => pago.created_at),
  ]).filter(Boolean).map((fecha) => new Date(fecha).getTime()).filter(Number.isFinite).reduce((max, fecha) => Math.max(max, fecha), 0);
  const confirmadoEn = revision.data?.confirmado_en ? new Date(revision.data.confirmado_en).getTime() : 0;
  return {
    obligaciones,
    revision: revision.data || null,
    coberturaConfirmada: Boolean(revision.data && confirmadoEn >= ultimaModificacion),
  };
}

export async function confirmarCoberturaObligaciones({ organizationId, businessId, nota }) {
  const texto = String(nota || "").trim();
  if (!organizationId || !businessId || texto.length < 8) throw new Error("Anota qué fuentes revisaste para confirmar la cobertura.");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) throw new Error("Inicia sesión para confirmar la revisión.");
  const { error } = await supabase.from("revisiones_obligaciones_operativas").insert({
    organization_id: organizationId,
    business_id: businessId,
    fecha_revision: hoyMexico(),
    nota: texto,
    confirmado_por: authData.user.id,
  });
  if (error) throw new Error(`No fue posible registrar la revisión: ${error.message}`);
}

export async function obtenerSalidasSinAsignar({ organizationId, businessId, branchId }) {
  if (!organizationId || !businessId) throw new Error("Falta el negocio para consultar salidas de dinero.");
  let consulta = supabase
    .from("cash_movements")
    .select("id, organization_id, business_id, branch_id, amount, concept, occurred_at")
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .eq("movement_type", "SALIDA")
    .eq("status", "Revisado")
    .order("occurred_at", { ascending: false })
    .limit(250);
  if (branchId) consulta = consulta.eq("branch_id", branchId);
  const { data: movimientos, error } = await consulta;
  if (error) throw new Error(`No fue posible consultar salidas registradas: ${error.message}`);
  const lista = movimientos || [];
  if (!lista.length) return [];
  const { data: asignaciones, error: errorAsignaciones } = await supabase
    .from("obligaciones_operativas_pagos")
    .select("cash_movement_id, importe")
    .in("cash_movement_id", lista.map((movimiento) => movimiento.id));
  if (errorAsignaciones) throw new Error(`No fue posible revisar abonos ya asignados: ${errorAsignaciones.message}`);
  const usados = new Map();
  for (const asignacion of asignaciones || []) {
    usados.set(asignacion.cash_movement_id, (usados.get(asignacion.cash_movement_id) || 0) + Number(asignacion.importe || 0));
  }
  return lista.map((movimiento) => ({
    ...movimiento,
    disponibleParaAsignar: Math.max(0, Math.round((Number(movimiento.amount) - (usados.get(movimiento.id) || 0)) * 100) / 100),
  })).filter((movimiento) => movimiento.disponibleParaAsignar > 0);
}

export async function crearObligacionOperativa({ organizationId, businessId, branchId = null, categoria, concepto, proveedor = null, importe, fechaVencimiento, frecuencia = "UNICA", notas = null }) {
  const monto = Number(importe);
  if (!organizationId || !businessId || !categoria || !concepto?.trim() || !fechaVencimiento || !Number.isFinite(monto) || monto <= 0) {
    throw new Error("Completa categoría, concepto, importe mayor que cero y fecha de vencimiento.");
  }
  const { data, error } = await supabase.from("obligaciones_operativas").insert({
    organization_id: organizationId,
    business_id: businessId,
    branch_id: branchId,
    categoria,
    concepto: concepto.trim(),
    proveedor: proveedor?.trim() || null,
    importe: Math.round(monto * 100) / 100,
    fecha_vencimiento: fechaVencimiento,
    frecuencia,
    notas: notas?.trim() || null,
  }).select("id").single();
  if (error) throw new Error(`No fue posible guardar la obligación. ${error.message}`);
  return data;
}

export async function asignarPagoObligacion({ organizationId, businessId, branchId = null, obligacionId, cashMovementId, importe }) {
  const monto = Number(importe);
  if (!organizationId || !businessId || !obligacionId || !cashMovementId || !Number.isFinite(monto) || monto <= 0) {
    throw new Error("Selecciona una obligación, una salida y un abono mayor que cero.");
  }
  const { data: usuarioData, error: errorUsuario } = await supabase.auth.getUser();
  if (errorUsuario || !usuarioData?.user?.id) throw new Error("Inicia sesión para registrar el abono.");
  const { error } = await supabase.from("obligaciones_operativas_pagos").insert({
    organization_id: organizationId,
    business_id: businessId,
    branch_id: branchId,
    obligacion_id: obligacionId,
    cash_movement_id: cashMovementId,
    importe: Math.round(monto * 100) / 100,
    registrado_por: usuarioData.user.id,
  });
  if (error) throw new Error(`No fue posible asignar el abono. ${error.message}`);
}
