import { supabase } from "../../../supabase";
import { consultarTodasLasPaginas } from "../../tesoreria/utils/paginarConsultaSupabase.js";
import { lineasDelNegocio, obtenerMovimientosDelMes } from "./conciliacionGastosService.js";
import { obtenerObligacionesOperativas } from "./obligacionesOperativasService";
import { analizarRentabilidad, construirEstadoResultados, elegirCargasPorDia } from "../../../core/finanzas/estadoResultados.js";

const TIPO_VENTAS = "Ventas por artículo";
const MAX_MESES = 13;

function validarMeses(meses) {
  const lista = [...new Set(meses || [])].sort();
  if (!lista.length || lista.length > MAX_MESES) throw new Error(`Indica de 1 a ${MAX_MESES} meses.`);
  for (const mes of lista) if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error(`Mes inválido: ${mes}`);
  return lista;
}

const finDeMes = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};

const esTablaInexistente = (error) => /42P01|PGRST205|does not exist|no existe|schema cache/i.test(`${error?.code || ""} ${error?.message || ""}`);

/* El negocio debe pertenecer a la organización activa. */
async function validarContexto(organizationId, businessId) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, organization_id")
    .eq("id", businessId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible validar el negocio: ${error.message}`);
  return Boolean(data) && String(data.organization_id) === String(organizationId);
}

/* Todas las sucursales del negocio, incluidas las inactivas (historial). */
async function sucursalesDelNegocio(businessId) {
  const { data, error } = await supabase.from("branches").select("id, business_id, name, active").eq("business_id", businessId).order("name", { ascending: true });
  if (error) throw new Error(`No fue posible cargar las sucursales: ${error.message}`);
  return (data || []).filter((s) => String(s.business_id) === String(businessId));
}

/* Cuentas de canal configuradas para el negocio; null si no se pueden leer. */
async function canalesConfigurados(organizationId, businessId) {
  const { data, error } = await supabase
    .from("canal_cuentas")
    .select("id, organization_id, business_id, canal, cuenta_externa, estado")
    .eq("organization_id", organizationId)
    .eq("business_id", businessId);
  if (error) {
    if (esTablaInexistente(error)) return null;
    throw new Error(`No fue posible leer los canales: ${error.message}`);
  }
  return (data || []).filter((c) => String(c.business_id) === String(businessId) && String(c.organization_id) === String(organizationId));
}

async function ventasSicarDelPeriodo({ organizationId, branchIds, desde, hasta }) {
  if (!branchIds.length) return { filas: [], importaciones: [] };
  const importaciones = await consultarTodasLasPaginas((inicio, fin) =>
    supabase
      .from("importaciones")
      .select("id, branch_id, created_at, organization_id")
      .eq("organization_id", organizationId)
      .in("branch_id", branchIds)
      .eq("tipo_reporte", TIPO_VENTAS)
      .eq("estado", "procesado")
      .order("id", { ascending: true })
      .range(inicio, fin)
  );
  const sucursales = new Set(branchIds.map(String));
  const propias = importaciones.filter((imp) => String(imp.organization_id) === String(organizationId) && sucursales.has(String(imp.branch_id)));

  // Periodo declarado del reporte (lo adjunta el importador a cada renglón).
  for (const imp of propias) {
    const { data, error } = await supabase
      .from("importacion_detalle")
      .select("importacion_id, periodoInicio:datos_originales->>periodoInicio, periodoFin:datos_originales->>periodoFin")
      .eq("importacion_id", imp.id)
      .order("numero_fila", { ascending: true })
      .limit(1);
    if (error) throw new Error(`No fue posible leer el periodo de una carga: ${error.message}`);
    imp.periodoInicio = data?.[0]?.periodoInicio || null;
    imp.periodoFin = data?.[0]?.periodoFin || null;
  }

  const filas = [];
  const ids = propias.map((imp) => imp.id);
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const consultar = (columnas) =>
      consultarTodasLasPaginas((inicio, fin) =>
        supabase.from("ventas_articulos").select(columnas).in("importacion_id", lote).gte("fecha", desde).lte("fecha", hasta).order("id", { ascending: true }).range(inicio, fin)
      );
    try {
      filas.push(...(await consultar("id, importacion_id, fecha, importe, utilidad, importe_disponible, utilidad_disponible")));
    } catch (error) {
      if (!/importe_disponible|utilidad_disponible/.test(String(error?.message))) throw error;
      // Sin la migración de banderas (#164): banderas desconocidas.
      filas.push(...(await consultar("id, importacion_id, fecha, importe, utilidad")));
    }
  }
  return { filas, importaciones: propias };
}

/*
 * Estados de resultados mensuales del negocio activo, con comparativo y
 * recomendaciones. Solo lectura.
 *
 * - Contexto validado: el negocio debe ser de la organización.
 * - Sucursales, canales y obligaciones salen de la configuración del
 *   negocio en la base, no de parámetros externos.
 * - canalesPorMes: resúmenes de canales por mes (de la sincronización);
 *   el motor descarta los de cuentas no configuradas para el negocio.
 * - bases: bases de IVA por fuente (configuración fiscal); sin ellas el
 *   resultado sale como provisional.
 */
export async function obtenerEstadosDeResultados({
  organizationId = null,
  businessId = null,
  meses = [],
  bases = {},
  isrPorMes = {},
  canalesPorMes = {},
  hoy = new Date().toISOString().slice(0, 10),
} = {}) {
  if (!organizationId || !businessId) {
    return { estado: "sin_contexto", motivo: !organizationId ? "Falta la organización activa." : "Falta el negocio activo." };
  }
  const lista = validarMeses(meses);
  if (!(await validarContexto(organizationId, businessId))) {
    return { estado: "sin_contexto", motivo: "El negocio no pertenece a la organización activa." };
  }

  const [sucursales, configurados, obligaciones] = await Promise.all([
    sucursalesDelNegocio(businessId),
    canalesConfigurados(organizationId, businessId),
    obtenerObligacionesOperativas({ organizationId, businessId }),
  ]);
  const deElNegocio = (fila) => String(fila?.organization_id) === String(organizationId) && String(fila?.business_id) === String(businessId);
  const obligacionesValidas = (obligaciones || []).filter(deElNegocio);

  const ventas = await ventasSicarDelPeriodo({
    organizationId,
    branchIds: sucursales.map((s) => s.id),
    desde: `${lista[0]}-01`,
    hasta: finDeMes(lista.at(-1)),
  });
  const sicar = elegirCargasPorDia(ventas.filas, ventas.importaciones);

  const errores = [];
  const estados = [];
  for (const mes of lista) {
    let movimientos = null;
    let cruce = null;
    try {
      cruce = lineasDelNegocio({ organizationId, businessId, ...(await obtenerMovimientosDelMes({ organizationId, businessId, mes })) });
      movimientos = cruce.lineas;
    } catch (error) {
      errores.push(`Tesorería ${mes}: ${error?.message || "no disponible"}`);
    }
    estados.push({
      ...construirEstadoResultados({
        businessId,
        mes,
        sucursales,
        sicar,
        diasCerrados: {}, // sin fuente de cierres confirmados todavía
        canales: canalesPorMes[mes] || [],
        canalesConfigurados: configurados,
        movimientos,
        obligaciones: obligacionesValidas,
        bases,
        isr: isrPorMes[mes] || {},
        hoy,
      }),
      pagosCruzados: cruce?.pagosCruzados || [],
    });
  }

  return {
    estado: "listo",
    errores,
    cargasSicarDescartadas: sicar.descartadas,
    estados,
    ...analizarRentabilidad(estados),
  };
}
