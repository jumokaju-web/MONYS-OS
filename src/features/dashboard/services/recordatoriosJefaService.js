import { supabase } from "../../../supabase";
import { construirRecordatoriosJefa } from "../utils/recordatoriosJefa.js";

export const obtenerRecordatoriosJefa = async ({
  organizationId = null,
  businessId = null,
} = {}) => {
  if (!organizationId || !businessId) {
    throw new Error("Falta identificar la organización y el negocio para revisar los reportes pendientes.");
  }

  const [resultadoSucursales, resultadoCuentas] = await Promise.all([
    supabase
      .from("branches")
      .select("id,name,active")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .eq("account_type", "banco")
      .eq("active", true),
  ]);

  if (resultadoSucursales.error) {
    throw new Error(`No fue posible revisar las sucursales del negocio: ${resultadoSucursales.error.message}`);
  }
  if (resultadoCuentas.error) {
    throw new Error(`No fue posible revisar las cuentas bancarias: ${resultadoCuentas.error.message}`);
  }

  const sucursales = resultadoSucursales.data || [];
  const branchIds = sucursales.map((sucursal) => sucursal.id).filter(Boolean);
  const accountIds = (resultadoCuentas.data || []).map((cuenta) => cuenta.id).filter(Boolean);
  let importaciones = [];
  let ultimoSaldo = null;

  if (branchIds.length > 0) {
    const resultadoImportaciones = await supabase
      .from("importaciones")
      .select("id,branch_id,tipo_reporte,estado,created_at")
      .in("branch_id", branchIds)
      .eq("estado", "procesado")
      .eq("tipo_reporte", "Ventas por artículo")
      .order("created_at", { ascending: false });

    if (resultadoImportaciones.error) {
      throw new Error(`No fue posible revisar las cargas SICAR: ${resultadoImportaciones.error.message}`);
    }
    importaciones = resultadoImportaciones.data || [];
  }

  if (accountIds.length > 0) {
    const resultadoSaldos = await supabase
      .from("account_balance_snapshots")
      .select("captured_at")
      .in("account_id", accountIds)
      .order("captured_at", { ascending: false })
      .limit(1);

    if (resultadoSaldos.error) {
      throw new Error(`No fue posible revisar los saldos bancarios: ${resultadoSaldos.error.message}`);
    }
    ultimoSaldo = resultadoSaldos.data?.[0]?.captured_at || null;
  }

  return {
    recordatorios: construirRecordatoriosJefa({ sucursales, importaciones, ultimoSaldo }),
    ultimaActualizacionBanco: ultimoSaldo,
  };
};
