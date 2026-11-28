import { supabase } from "../../../supabase";
import { consultarTodasLasPaginas } from "../../tesoreria/utils/paginarConsultaSupabase.js";
import { obtenerSucursalesInventario } from "../../inventario/services/inventarioService";
import { lineasDelNegocio, obtenerMovimientosDelMes } from "./conciliacionGastosService.js";
import {
  agregarVentasSicarPorMes,
  analizarRentabilidad,
  construirEstadoResultados,
  filasSinCargasDuplicadas,
} from "../../../core/finanzas/estadoResultados.js";

const TIPO_VENTAS = "Ventas por artículo";
const MAX_MESES = 13;

function validarMeses(meses) {
  const lista = [...new Set(meses || [])].sort();
  if (!lista.length || lista.length > MAX_MESES) throw new Error(`Indica de 1 a ${MAX_MESES} meses.`);
  for (const mes of lista) if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error(`Mes inválido: ${mes}`);
  return lista;
}

function finDeMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
}

async function ventasSicarDelPeriodo({ organizationId, branchIds, desde, hasta }) {
  if (!branchIds.length) return { filas: [], importaciones: [], descartadas: 0 };
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
  const propias = importaciones.filter(
    (imp) => String(imp.organization_id) === String(organizationId) && sucursales.has(String(imp.branch_id))
  );
  const filas = [];
  const ids = propias.map((imp) => imp.id);
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const consultar = (columnas) =>
      consultarTodasLasPaginas((inicio, fin) =>
        supabase
          .from("ventas_articulos")
          .select(columnas)
          .in("importacion_id", lote)
          .gte("fecha", desde)
          .lte("fecha", hasta)
          .order("id", { ascending: true })
          .range(inicio, fin)
      );
    try {
      filas.push(...(await consultar("id, importacion_id, fecha, importe, utilidad, importe_disponible, utilidad_disponible")));
    } catch (error) {
      // Sin la migración de banderas (#164) se lee sin ellas.
      if (!/importe_disponible|utilidad_disponible/.test(String(error?.message))) throw error;
      filas.push(...(await consultar("id, importacion_id, fecha, importe, utilidad")));
    }
  }
  const { filas: elegidas, descartadas } = filasSinCargasDuplicadas(filas, propias);
  return { filas: elegidas, importaciones: propias, descartadas };
}

/*
 * Estados de resultados mensuales del negocio activo + comparativo y
 * recomendaciones. Solo lectura.
 *
 * canalesPorMes: { "2026-10": [{ resumen, publicidad, baseIva }] } desde
 *   la sincronización de canales (#169/#170). canalesEsperados: canales del
 *   negocio; los que falten en un mes quedan como dato faltante.
 */
export async function obtenerEstadosDeResultados({
  organizationId = null,
  businessId = null,
  meses = [],
  baseIvaSicar = {},
  isrPorMes = {},
  interesesPorMes = {},
  canalesPorMes = {},
  canalesEsperados = [],
  hoy = new Date().toISOString().slice(0, 10),
} = {}) {
  if (!organizationId || !businessId) {
    return { estado: "sin_contexto", motivo: !organizationId ? "Falta la organización activa." : "Falta el negocio activo." };
  }
  const lista = validarMeses(meses);

  const sucursales = (await obtenerSucursalesInventario(businessId)).filter(
    (sucursal) => String(sucursal?.business_id) === String(businessId)
  );
  const branchIds = sucursales.map((s) => s.id);
  const ventas = await ventasSicarDelPeriodo({
    organizationId, branchIds, desde: `${lista[0]}-01`, hasta: finDeMes(lista.at(-1)),
  });
  const ventasSucursal = agregarVentasSicarPorMes(ventas.filas);

  const errores = [];
  const estados = [];
  for (const mes of lista) {
    let movimientos = null;
    let cruce = null;
    try {
      const leidos = await obtenerMovimientosDelMes({ organizationId, businessId, mes });
      cruce = lineasDelNegocio({ organizationId, businessId, ...leidos });
      movimientos = cruce.lineas;
    } catch (error) {
      errores.push(`Tesorería ${mes}: ${error?.message || "no disponible"}`);
    }
    const canales = canalesPorMes[mes] || [];
    const presentes = new Set(canales.map((c) => String(c?.resumen?.canal)));
    estados.push({
      ...construirEstadoResultados({
        businessId,
        mes,
        sucursales,
        ventasSucursal,
        canales,
        canalesSinDatos: (canalesEsperados || []).filter((c) => !presentes.has(String(c))),
        movimientos,
        baseIvaSicar,
        intereses: interesesPorMes[mes] || {},
        isr: isrPorMes[mes] || {},
        hoy,
      }),
      pagosCruzados: cruce?.pagosCruzados || [],
    });
  }

  return {
    estado: "listo",
    errores,
    cargasSicarDescartadasPorDuplicado: ventas.descartadas,
    estados,
    ...analizarRentabilidad(estados),
  };
}
