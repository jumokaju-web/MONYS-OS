import { supabase } from "../../../supabase";

export async function listarMovimientosFinancierosRH(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("rh_movimientos_financieros")
    .select("id,empleado_id,tipo,monto,concepto,periodo_desde,periodo_hasta,origen,fuente_id,estado,referencia_pago,pagado_en,motivo_anulacion,created_at,empleados(nombre),rh_recuperaciones_movimiento(id,monto,fecha,metodo,nota,estado,created_at)")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "No fue posible consultar los pagos de RH.");
  return data || [];
}

export async function registrarMovimientoFinancieroRH(datos = {}) {
  const { data, error } = await supabase.rpc("registrar_movimiento_financiero_rh", {
    p_empleado_id: datos.empleadoId,
    p_tipo: datos.tipo,
    p_monto: Number(datos.monto),
    p_concepto: String(datos.concepto || "").trim(),
    p_periodo_desde: datos.periodoDesde || null,
    p_periodo_hasta: datos.periodoHasta || null,
    p_origen: "MANUAL",
    p_fuente_id: null,
    p_snapshot: {},
  });
  if (error) throw new Error(error.message || "No fue posible registrar el movimiento.");
  return data;
}

export async function registrarLiquidacionesComisionRH({ desde, hasta, importacionId, partidas }) {
  const { data, error } = await supabase.rpc("registrar_liquidaciones_comision_rh", {
    p_periodo_desde: desde,
    p_periodo_hasta: hasta,
    p_fuente_id: importacionId,
    p_partidas: (partidas || []).map((item) => ({
      empleado_id: item.empleadoId,
      monto: Number(item.comision),
      snapshot: item,
    })),
  });
  if (error) throw new Error(error.message || "No fue posible preparar las liquidaciones de comisión.");
  return data || [];
}

export async function marcarMovimientoPagadoRH({ movimientoId, referencia }) {
  const { data, error } = await supabase.rpc("marcar_movimiento_financiero_rh_pagado", {
    p_movimiento_id: movimientoId,
    p_referencia: String(referencia || "").trim(),
  });
  if (error) throw new Error(error.message || "No fue posible confirmar el pago.");
  return data;
}

export async function anularMovimientoFinancieroRH({ movimientoId, motivo }) {
  const { data, error } = await supabase.rpc("anular_movimiento_financiero_rh", {
    p_movimiento_id: movimientoId,
    p_motivo: String(motivo || "").trim(),
  });
  if (error) throw new Error(error.message || "No fue posible anular el registro.");
  return data;
}

export async function registrarRecuperacionRH({ movimientoId, monto, metodo, nota }) {
  const { data, error } = await supabase.rpc("registrar_recuperacion_movimiento_rh", {
    p_movimiento_id: movimientoId,
    p_monto: Number(monto),
    p_metodo: metodo,
    p_nota: String(nota || "").trim(),
  });
  if (error) throw new Error(error.message || "No fue posible registrar la recuperación.");
  return data;
}
