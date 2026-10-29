import { supabase } from "../../../supabase";
import { obtenerFacturasIngresoFlotillaPeriodo } from "../../dashboard/services/facturasIngresoFlotillaService.js";
import { consultarTodasLasPaginas } from "../../tesoreria/utils/paginarConsultaSupabase.js";
import { validarCicloLunesDomingo } from "../../inteligencia/utils/cicloFinancieroSemanal.js";

function validarPeriodo(desde, hasta) {
  if (typeof desde !== "string" || typeof hasta !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    throw new Error("Selecciona fechas válidas con formato AAAA-MM-DD para el expediente semanal.");
  }
  const ciclo = validarCicloLunesDomingo(desde, hasta);
  if (!ciclo.valido) throw new Error(ciclo.motivo);
}

async function contextoPropietaria(usuario) {
  if (usuario?.role !== "owner" || !usuario?.auth_user_id || !usuario?.organization_id
    || !usuario?.business_id || !usuario?.branch_id) {
    throw new Error("Se requiere una sesión de propietaria con organización, negocio y sucursal.");
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id || data.user.id !== usuario.auth_user_id) {
    throw new Error("La sesión cambió. Inicia sesión de nuevo para revisar el expediente semanal.");
  }
  return {
    organization_id: usuario.organization_id,
    business_id: usuario.business_id,
    branch_id: usuario.branch_id,
    created_by: usuario.auth_user_id,
  };
}

// La revisión disponible es la última guardada por esta propietaria en el contexto
// actual. No representa todos los bancos ni todas las revisiones históricas.
export async function obtenerExpedienteSemanalFlotilla({ usuario, desde, hasta } = {}) {
  validarPeriodo(desde, hasta);
  const scope = await contextoPropietaria(usuario);

  const facturasPeriodo = await obtenerFacturasIngresoFlotillaPeriodo({
    organizationId: scope.organization_id,
    desde,
    hasta,
    criterio: "servicio_o_cobro",
  });
  if (!facturasPeriodo || !Array.isArray(facturasPeriodo.facturas)
    || typeof facturasPeriodo.negocioEncontrado !== "boolean") {
    throw new Error("No se confirmó la consulta de facturas de Flotilla.");
  }

  let consultaRevision = supabase.from("revisiones_bancarias").select("id,organization_id,business_id,branch_id,created_at,paquete");
  for (const [campo, valor] of Object.entries(scope)) consultaRevision = consultaRevision.eq(campo, valor);
  const { data: revisionBancaria, error: errorRevision } = await consultaRevision
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (errorRevision) throw new Error(`No fue posible cargar la revisión bancaria del expediente: ${errorRevision.message}`);
  if (revisionBancaria && !revisionBancaria.id) throw new Error("La revisión bancaria no tiene una identidad válida.");

  let conciliaciones = [];
  if (revisionBancaria) {
    try {
      conciliaciones = await consultarTodasLasPaginas((inicio, fin) => supabase
        .from("conciliaciones_bancarias")
        .select("id,organization_id,business_id,branch_id,revision_bancaria_id,banco_movimiento_id,cash_movement_id,cuenta,fecha_banco,monto,direccion,estado,registrado_en,snapshot")
        .eq("organization_id", scope.organization_id)
        .eq("business_id", scope.business_id)
        .eq("branch_id", scope.branch_id)
        .eq("revision_bancaria_id", revisionBancaria.id)
        .eq("estado", "ACTIVA")
        .order("registrado_en", { ascending: false })
        .order("id", { ascending: true })
        .range(inicio, fin));
    } catch (error) {
      throw new Error(`No fue posible cargar las conciliaciones del expediente: ${error.message}`);
    }
  }

  const movimientosTesoreria = [];
  const idsMovimientos = [...new Set(facturasPeriodo.facturas
    .map((factura) => factura.movimiento_tesoreria_id)
    .filter((id) => typeof id === "string" && id.trim()))];
  try {
    for (let indice = 0; indice < idsMovimientos.length; indice += 100) {
      const lote = idsMovimientos.slice(indice, indice + 100);
      const movimientos = await consultarTodasLasPaginas((inicio, fin) => supabase
        .from("cash_movements")
        .select("id,organization_id,business_id,account_id,movement_type,amount,status,occurred_at")
        .eq("organization_id", scope.organization_id)
        .in("id", lote)
        .order("id", { ascending: true })
        .range(inicio, fin));
      movimientosTesoreria.push(...movimientos);
    }
  } catch (error) {
    throw new Error(`No fue posible cargar los movimientos vigentes de Tesorería del expediente: ${error.message}`);
  }

  return {
    facturas: facturasPeriodo.facturas,
    negocioEncontrado: facturasPeriodo.negocioEncontrado,
    revisionBancaria: revisionBancaria || null,
    conciliaciones,
    movimientosTesoreria,
  };
}
