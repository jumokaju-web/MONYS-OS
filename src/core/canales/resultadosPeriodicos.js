/*
 * RESULTADOS DIARIOS, SEMANALES Y MENSUALES POR CANAL · MONYS OS
 *
 * Agrupa las órdenes de cada canal por periodo (fecha local de Ciudad de
 * México) y aplica resumirOrdenesMarketplace a cada grupo. Luego arma el
 * consolidado de Monys Glam con la venta de tienda (SICAR) del mismo
 * periodo. Las ventas de marketplaces NO se registran en SICAR (confirmado
 * por la propietaria), así que se suman sin duplicar. Módulo puro.
 */
import { consolidarCanales, resumirOrdenesMarketplace } from "./rentabilidadMarketplace.js";

const DESFASE_CDMX_MS = 6 * 3600 * 1000;

function fechaLocal(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Date(fecha.getTime() - DESFASE_CDMX_MS);
}

/*
 * Clave del periodo:
 * - dia:    YYYY-MM-DD
 * - semana: YYYY-MM-DD del lunes de esa semana
 * - mes:    YYYY-MM
 */
export function clavePeriodo(valor, granularidad) {
  const local = fechaLocal(valor);
  if (!local) return null;
  const dia = local.toISOString().slice(0, 10);
  if (granularidad === "dia") return dia;
  if (granularidad === "mes") return dia.slice(0, 7);
  if (granularidad === "semana") {
    const diaSemana = (local.getUTCDay() + 6) % 7; // lunes = 0
    return new Date(local.getTime() - diaSemana * 86400000).toISOString().slice(0, 10);
  }
  throw new Error(`Granularidad inválida: ${granularidad}`);
}

/*
 * canales: { [canal]: { ordenes, opciones } } (opciones = las de
 *   resumirOrdenesMarketplace: costos, retención, hoy).
 * ventasSicarPorPeriodo: { [clave]: venta de tienda } (opcional).
 */
export function resultadosPorPeriodo({ canales = {}, granularidad = "mes", ventasSicarPorPeriodo = {} } = {}) {
  const claves = new Set(Object.keys(ventasSicarPorPeriodo || {}));
  const agrupado = {};
  const sinFecha = {};

  for (const [canal, { ordenes = [], opciones = {} } = {}] of Object.entries(canales)) {
    agrupado[canal] = {};
    sinFecha[canal] = 0;
    for (const orden of ordenes) {
      const clave = clavePeriodo(orden?.fecha, granularidad);
      if (!clave) {
        sinFecha[canal] += 1;
        continue;
      }
      claves.add(clave);
      (agrupado[canal][clave] ||= []).push(orden);
    }
    agrupado[canal]._opciones = opciones;
  }

  const periodos = [...claves].sort().map((clave) => {
    const porCanal = {};
    for (const canal of Object.keys(canales)) {
      const ordenes = agrupado[canal][clave] || [];
      porCanal[canal] = resumirOrdenesMarketplace(ordenes, { canal, ...agrupado[canal]._opciones });
    }
    const ventaSicar = ventasSicarPorPeriodo?.[clave];
    const consolidado = consolidarCanales({
      ventaSicar: ventaSicar === undefined ? null : ventaSicar,
      canales: Object.entries(porCanal).map(([canal, resumen]) => ({
        canal,
        ventasPagadas: resumen.ventasPagadas,
        registradoEnSicar: false,
      })),
    });
    const utilidades = Object.values(porCanal).map((resumen) => resumen.utilidad);
    return {
      periodo: clave,
      granularidad,
      porCanal,
      ventaCanales: Math.round(Object.values(porCanal).reduce((suma, resumen) => suma + resumen.ventasPagadas, 0) * 100) / 100,
      utilidadCanales: utilidades.every((valor) => valor !== null)
        ? Math.round(utilidades.reduce((suma, valor) => suma + valor, 0) * 100) / 100
        : null,
      consolidadoMonysGlam: consolidado,
    };
  });

  return { granularidad, periodos, ordenesSinFecha: sinFecha };
}
