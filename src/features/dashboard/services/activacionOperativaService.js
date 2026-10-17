import { supabase } from "../../../supabase";
import { obtenerCuentasBancariasParaConfirmar } from "../../tesoreria/services/cuentasFinancierasService";
import { obtenerCreditosProveedoresActuales } from "../../inteligencia/services/creditosProveedoresService";

function fuente(disponible, filas = [], error = null) {
  return {
    disponible,
    filas: disponible ? filas || [] : [],
    error: error?.message || null,
  };
}

async function consultar(nombre, consulta) {
  try {
    const { data, error } = await consulta;
    if (error) throw error;
    return [nombre, fuente(true, data)];
  } catch (error) {
    console.error(`No se pudo comprobar ${nombre} para activación operativa:`, error);
    return [nombre, fuente(false, [], error)];
  }
}

async function consultarValor(nombre, consulta, valorVacio) {
  try {
    return { disponible: true, valor: await consulta, error: null };
  } catch (error) {
    console.error(`No se pudo comprobar ${nombre} para activación operativa:`, error);
    return { disponible: false, valor: valorVacio, error: error?.message || null };
  }
}

export async function obtenerFuentesActivacionOperativa({
  organizationId,
  businessId,
} = {}) {
  if (!organizationId || !businessId) {
    throw new Error("Falta identificar la organización y el negocio.");
  }

  const resultadoEmpleados = await consultar("empleados", supabase
    .from("empleados")
    .select("id,active,usuario_id,branch_id,puesto")
    .eq("organization_id", organizationId)
    .eq("business_id", businessId));
  const empleados = resultadoEmpleados[1];
  const empleadoIds = empleados.disponible
    ? empleados.filas.map((item) => item.id).filter(Boolean)
    : [];
  const perfiles = !empleados.disponible
    ? fuente(false, [], new Error("No fue posible delimitar los perfiles del negocio."))
    : empleadoIds.length === 0
      ? fuente(true, [])
      : (await consultar("perfiles", supabase
        .from("empleado_configuracion_operativa")
        .select("empleado_id,usuario_id,branch_id")
        .in("empleado_id", empleadoIds)))[1];

  const consultas = [
    consultar("sucursales", supabase
      .from("branches")
      .select("id,name,active")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name", { ascending: true })),
    consultar("horarios", supabase
      .from("empleado_horario_semanal")
      .select("empleado_id,dia_semana,estado,branch_id")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)),
    consultar("tareas", supabase
      .from("tareas_operativas")
      .select("id,area,estado,fecha,responsable_usuario_id,branch_id")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .in("estado", ["pendiente", "en_proceso", "analizando"])),
    consultar("campanas", supabase
      .from("campanas_marketing")
      .select("id,estado,resultado,branch_id,updated_at")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)
      .in("estado", ["ACTIVA", "PAUSADA", "BORRADOR"])),
    consultar("rutas", supabase
      .from("flotilla_rutas")
      .select("id,estado,fecha")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)),
    consultar("incidenciasFlotilla", supabase
      .from("flotilla_incidencias")
      .select("id,estado,created_at")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)),
    consultar("pnr", supabase
      .from("flotilla_pnr_expedientes")
      .select("id,estado,created_at")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)),
    consultar("movimientosFlotilla", supabase
      .from("flotilla_movimientos_dinero")
      .select("id,estado_conciliacion,created_at")
      .eq("organization_id", organizationId)
      .eq("business_id", businessId)),
  ];

  const resultados = await Promise.all(consultas);
  const fuentes = Object.fromEntries(resultados);
  const bancos = await consultarValor(
    "cuentas bancarias",
    obtenerCuentasBancariasParaConfirmar({ organizationId, businessId }),
    { cuentas: [], saldoTotal: null, completo: false },
  );
  const sucursales = fuentes.sucursales;
  const proveedores = !sucursales?.disponible
    ? { disponible: false, filas: [], error: "No fue posible delimitar las sucursales activas." }
    : fuente(true, await Promise.all((sucursales.filas || []).map(async (sucursal) => {
      const resultado = await consultarValor(
        `proveedores de ${sucursal.name || "sucursal"}`,
        obtenerCreditosProveedoresActuales(sucursal.id),
        { importacion: null, creditos: [], saldoTotal: null },
      );
      return {
        branchId: sucursal.id,
        sucursal: sucursal.name || "Sucursal",
        disponible: resultado.disponible,
        error: resultado.error,
        importacion: resultado.valor?.importacion || null,
        creditos: resultado.valor?.creditos || [],
        saldoTotal: resultado.valor?.importacion ? resultado.valor.saldoTotal : null,
      };
    })));

  return {
    empleados,
    perfiles,
    ...fuentes,
    bancos,
    proveedores,
  };
}
