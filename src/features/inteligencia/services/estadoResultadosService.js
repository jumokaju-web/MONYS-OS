import { supabase } from "../../../supabase";
import { consultarTodasLasPaginas } from "../../tesoreria/utils/paginarConsultaSupabase.js";
import { lineasDelNegocio, obtenerMovimientosDelMes } from "./conciliacionGastosService.js";
import { obtenerObligacionesOperativas } from "./obligacionesOperativasService";
import { obtenerEquilibrioReal } from "./equilibrioRealService.js";
import { obtenerDeudasFinancieras } from "./deudasFinancierasService.js";
import { obtenerCalendarioOperativo } from "../../operacion/services/calendarioOperativoService.js";
import { obtenerVinculosPlataforma } from "../../tesoreria/services/conciliacionPlataformasService.js";
import { analizarRentabilidad, construirEstadoResultados, elegirCargasPorDia } from "../../../core/finanzas/estadoResultados.js";
import { calendarioDelNegocio } from "../../../core/operacion/calendarioOperativo.js";
import { canalesDelMes } from "../../../core/canales/canalesDelMes.js";
import { equilibrioPorSucursal, gastosQueMasPesan } from "../../../core/finanzas/equilibrioSucursal.js";
import { diagnosticarFuentes } from "../../../core/finanzas/diagnosticoFuentes.js";
import { accionesDelDiaAContrato, normalizarRecomendaciones, prioridadesDeHoy, urgenciasDeEquilibrio } from "../../../core/finanzas/recomendacionesHoy.js";

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

async function validarContexto(organizationId, businessId) {
  const { data, error } = await supabase.from("businesses").select("id, organization_id").eq("id", businessId).eq("organization_id", organizationId).maybeSingle();
  if (error) throw new Error(`No fue posible validar el negocio: ${error.message}`);
  return Boolean(data) && String(data.organization_id) === String(organizationId);
}

async function sucursalesDelNegocio(businessId) {
  const { data, error } = await supabase.from("branches").select("id, business_id, name, active").eq("business_id", businessId).order("name", { ascending: true });
  if (error) throw new Error(`No fue posible cargar las sucursales: ${error.message}`);
  return (data || []).filter((s) => String(s.business_id) === String(businessId));
}

async function ventasSicarDelPeriodo({ organizationId, branchIds, desde, hasta }) {
  if (!branchIds.length) return { filas: [], importaciones: [] };
  const importaciones = await consultarTodasLasPaginas((inicio, fin) =>
    supabase.from("importaciones").select("id, branch_id, created_at, organization_id")
      .eq("organization_id", organizationId).in("branch_id", branchIds).eq("tipo_reporte", TIPO_VENTAS).eq("estado", "procesado")
      .order("id", { ascending: true }).range(inicio, fin)
  );
  const sucursales = new Set(branchIds.map(String));
  const propias = importaciones.filter((imp) => String(imp.organization_id) === String(organizationId) && sucursales.has(String(imp.branch_id)));
  // Periodo y alcance declarados (el importador los adjunta a cada renglón).
  for (const imp of propias) {
    const { data, error } = await supabase.from("importacion_detalle")
      .select("importacion_id, periodoInicio:datos_originales->>periodoInicio, periodoFin:datos_originales->>periodoFin, alcance:datos_originales->>alcanceSicar")
      .eq("importacion_id", imp.id).order("numero_fila", { ascending: true }).limit(1);
    if (error) throw new Error(`No fue posible leer el periodo de una carga: ${error.message}`);
    imp.periodoInicio = data?.[0]?.periodoInicio || null;
    imp.periodoFin = data?.[0]?.periodoFin || null;
    imp.alcance = data?.[0]?.alcance || null;
  }
  const filas = [];
  const ids = propias.map((imp) => imp.id);
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const consultar = (columnas) => consultarTodasLasPaginas((inicio, fin) =>
      supabase.from("ventas_articulos").select(columnas).in("importacion_id", lote).gte("fecha", desde).lte("fecha", hasta).order("id", { ascending: true }).range(inicio, fin));
    try {
      filas.push(...(await consultar("id, importacion_id, fecha, importe, utilidad, importe_disponible, utilidad_disponible")));
    } catch (error) {
      if (!/importe_disponible|utilidad_disponible/.test(String(error?.message))) throw error;
      filas.push(...(await consultar("id, importacion_id, fecha, importe, utilidad")));
    }
  }
  return { filas, importaciones: propias };
}

/* Tablas de canales (#170) y costos SICAR. cuentas = null: configuración no disponible. */
async function datosDeCanales({ organizationId, businessId, desde, hasta }) {
  const r = await supabase.from("canal_cuentas").select("id, organization_id, business_id, canal, cuenta_externa, estado, ultimo_sync, historico_desde")
    .eq("organization_id", organizationId).eq("business_id", businessId);
  if (r.error) {
    if (esTablaInexistente(r.error)) return { cuentas: null };
    throw new Error(`No fue posible leer las cuentas de canal: ${r.error.message}`);
  }
  const cuentas = (r.data || []).filter((c) => String(c.business_id) === String(businessId) && String(c.organization_id) === String(organizationId));
  if (!cuentas.length) return { cuentas, ordenes: [], items: [], publicaciones: [], vinculos: [], productosSicar: [] };
  const ids = cuentas.map((c) => c.id);
  const ordenes = await consultarTodasLasPaginas((inicio, fin) =>
    supabase.from("canal_ordenes").select("id, cuenta_id, business_id, external_id, fecha, estado, total, comision, envio_vendedor, envio_estado, fecha_liberacion, motivo_cancelacion")
      .eq("business_id", businessId).in("cuenta_id", ids).gte("fecha", `${desde}T06:00:00Z`).lte("fecha", `${hasta}T23:59:59-06:00`).order("id", { ascending: true }).range(inicio, fin));
  const items = [];
  for (let i = 0; i < ordenes.length; i += 200) {
    items.push(...(await consultarTodasLasPaginas((inicio, fin) =>
      supabase.from("canal_orden_items").select("orden_id, publicacion, variacion, titulo, sku, cantidad, precio_unit, comision")
        .in("orden_id", ordenes.slice(i, i + 200).map((o) => o.id)).order("orden_id").range(inicio, fin))));
  }
  const publicaciones = await consultarTodasLasPaginas((inicio, fin) =>
    supabase.from("canal_publicaciones").select("cuenta_id, publicacion, variacion, sku, codigo_barras, titulo").eq("business_id", businessId).in("cuenta_id", ids).order("publicacion").range(inicio, fin));
  const { data: vinculos, error: errorV } = await supabase.from("producto_vinculos").select("canal, publicacion, codigo_sicar, business_id").eq("business_id", businessId);
  if (errorV) throw new Error(`No fue posible leer los vínculos de productos: ${errorV.message}`);
  const productos = await consultarTodasLasPaginas((inicio, fin) => supabase.from("productos").select("sku, codigo_barras, costo, nombre").order("sku").range(inicio, fin));
  return {
    cuentas, ordenes, items, publicaciones,
    vinculos: (vinculos || []).filter((v) => String(v.business_id) === String(businessId)),
    productosSicar: productos.map((p) => ({ codigo: p.sku, codigo_barras: p.codigo_barras, costo: p.costo, descripcion: p.nombre })),
  };
}

/*
 * Tablero financiero del negocio activo (solo lectura): estados de
 * resultados por mes, comparativo, recomendaciones, equilibrio por
 * sucursal y consolidado, gastos que más pesan y diagnóstico de fuentes.
 *
 * - Contexto validado: el negocio debe ser de la organización.
 * - Sucursales, canales, calendario, obligaciones, deudas y vínculos salen
 *   de la base del negocio; ningún resumen se acepta de fuera.
 * - bases / basesCanales: bases de IVA (configuración fiscal); sin ellas el
 *   resultado sale provisional, no se detiene.
 * - mesObjetivo: mes de la venta diaria necesaria (default: el en curso).
 * - accionesDelDia: acciones ya calculadas por #163 (traspasos, compras,
 *   abonos) para unirlas sin duplicar en queHacerHoy. Opcional.
 */
export async function obtenerTableroFinanciero({
  organizationId = null,
  businessId = null,
  meses = [],
  bases = {},
  basesCanales = {},
  isrPorMes = {},
  publicidadPorMes = {},
  mesObjetivo = null,
  accionesDelDia = [],
  hoy = new Date().toISOString().slice(0, 10),
} = {}) {
  if (!organizationId || !businessId) {
    return { estado: "sin_contexto", motivo: !organizationId ? "Falta la organización activa." : "Falta el negocio activo." };
  }
  const lista = validarMeses(meses);
  if (!(await validarContexto(organizationId, businessId))) {
    return { estado: "sin_contexto", motivo: "El negocio no pertenece a la organización activa." };
  }
  const objetivo = mesObjetivo || String(hoy).slice(0, 7);
  const desde = `${lista[0]}-01`;
  const hasta = finDeMes(lista.at(-1) > objetivo ? lista.at(-1) : objetivo);
  const errores = [];

  const deElNegocio = (f) => String(f?.organization_id) === String(organizationId) && String(f?.business_id) === String(businessId);
  const [sucursales, obligaciones, calendarioDatos, canalesDatos, deudas] = await Promise.all([
    sucursalesDelNegocio(businessId),
    obtenerObligacionesOperativas({ organizationId, businessId }),
    obtenerCalendarioOperativo({ organizationId, businessId, desde, hasta }),
    datosDeCanales({ organizationId, businessId, desde, hasta }),
    obtenerDeudasFinancieras({ organizationId, businessId }).catch((error) => {
      errores.push(`Créditos: ${error?.message || "no disponibles"}`);
      return null;
    }),
  ]);
  const obligacionesValidas = (obligaciones || []).filter(deElNegocio);
  const ventas = await ventasSicarDelPeriodo({ organizationId, branchIds: sucursales.map((s) => s.id), desde, hasta: finDeMes(lista.at(-1)) });
  const sicar = elegirCargasPorDia(ventas.filas, ventas.importaciones);

  const estados = [];
  for (const mes of lista) {
    let movimientos = null;
    let cruce = null;
    let vinculos = null;
    try {
      cruce = lineasDelNegocio({ organizationId, businessId, ...(await obtenerMovimientosDelMes({ organizationId, businessId, mes })) });
      movimientos = cruce.lineas;
      vinculos = await obtenerVinculosPlataforma({ organizationId, businessId, movimientoIds: movimientos.map((m) => m.id).filter(Boolean) });
    } catch (error) {
      errores.push(`Tesorería ${mes}: ${error?.message || "no disponible"}`);
    }
    const calendario = calendarioDatos ? calendarioDelNegocio({ sucursales, mes, ...calendarioDatos, hoy }) : null;
    const canales = canalesDatos.cuentas
      ? canalesDelMes({ businessId, mes, ...canalesDatos, publicidadPorCuenta: publicidadPorMes[mes] || {}, basesIva: basesCanales, hoy })
      : [];
    estados.push({
      ...construirEstadoResultados({
        businessId, mes, sucursales, sicar, calendario, canales,
        canalesConfigurados: canalesDatos.cuentas,
        vinculosPlataforma: vinculos, movimientos, obligaciones: obligacionesValidas, bases,
        isr: isrPorMes[mes] || {}, hoy,
      }),
      pagosCruzados: cruce?.pagosCruzados || [],
      porVincular: canales.flatMap((c) => c.porVincular || []),
    });
  }

  const analisis = analizarRentabilidad(estados);
  // Base del equilibrio por sucursal: el último mes cerrado con margen.
  const base = [...estados].reverse().find((e) => !e.parcial && e.unidades.some((u) => u.tipo === "sucursal" && u.utilidadBruta !== null)) || null;
  const calendarioObjetivo = calendarioDatos ? calendarioDelNegocio({ sucursales, mes: objetivo, ...calendarioDatos }) : null;
  const porSucursal = base ? equilibrioPorSucursal({ businessId, estadoBase: base, mesObjetivo: objetivo, obligaciones: obligacionesValidas, calendario: calendarioObjetivo }) : null;
  let consolidado = null;
  try {
    consolidado = await obtenerEquilibrioReal({ organizationId, businessId, mes: objetivo });
  } catch (error) {
    errores.push(`Equilibrio consolidado: ${error?.message || "no disponible"}`);
  }

  return {
    estado: "listo",
    errores,
    cargasSicarDescartadas: sicar.descartadas,
    estados,
    ...analisis,
    equilibrio: { porSucursal, consolidado, mesBase: base?.mes ?? null, mesObjetivo: objetivo },
    gastosQueMasPesan: base ? gastosQueMasPesan(base) : [],
    queHacerHoy: prioridadesDeHoy([
      normalizarRecomendaciones({ businessId, recomendaciones: analisis.recomendaciones, comparativo: analisis.comparativo }),
      urgenciasDeEquilibrio({ businessId, equilibrio: porSucursal }),
      accionesDelDiaAContrato({ businessId, acciones: accionesDelDia, hoy }),
    ]),
    fuentes: diagnosticarFuentes({ estados, equilibrio: consolidado, deudasRegistradas: Array.isArray(deudas) ? deudas.length : null }),
  };
}

/* Compatibilidad: solo estados, comparativo y recomendaciones. */
export async function obtenerEstadosDeResultados(opciones = {}) {
  const tablero = await obtenerTableroFinanciero(opciones);
  if (tablero.estado !== "listo") return tablero;
  const { estados, comparativo, recomendaciones, errores, cargasSicarDescartadas } = tablero;
  return { estado: "listo", errores, cargasSicarDescartadas, estados, comparativo, recomendaciones };
}
