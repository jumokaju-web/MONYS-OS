/*
 * PUNTO DE EQUILIBRIO POR SUCURSAL Y VENTA DIARIA NECESARIA · MONYS OS
 *
 * Reutiliza, sin recalcular:
 * - el estado de resultados de un mes base cerrado (margen bruto real y
 *   gastos de venta de cada unidad);
 * - gastosFijosDelMes (motor de equilibrio) para el devengo y lo que vence
 *   en el mes objetivo, con las obligaciones de cada sucursal;
 * - el calendario operativo del mes objetivo (días con venta esperada).
 *
 * Por sucursal:
 * - operativo directo: venta para cubrir sus gastos propios devengados;
 * - operativo con generales: además, su parte de los gastos generales
 *   repartida por ventas (SUPUESTO, aparte);
 * - efectivo directo: venta para pagar lo que le vence en el mes.
 * La deuda y los impuestos son del negocio: van en el consolidado
 * (construirEquilibrioReal de #166), no se reparten entre sucursales.
 * Dato faltante ≠ 0: sin margen, gastos o días, el indicador queda null.
 * Módulo puro.
 */
import { gastosFijosDelMes } from "./equilibrioReal.js";

const r2 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r1 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const diasMes = (mes) => { const [a, m] = mes.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };

function obligacionesDe(obligaciones, businessId, branchId) {
  return (obligaciones || []).filter((o) =>
    String(o?.business_id ?? businessId) === String(businessId) &&
    String(o?.categoria || "").toUpperCase() !== "IMPUESTOS" &&
    (branchId === null ? !o?.branch_id : String(o?.branch_id) === String(branchId)));
}

/*
 * estadoBase:  construirEstadoResultados de un mes cerrado.
 * mesObjetivo: mes para el que se calcula la venta necesaria.
 * calendario:  { [branchId]: calendarioDelMes(mesObjetivo) } calculado sin
 *              "hoy" (cuenta cierres programados), o null.
 * obligaciones: obligaciones operativas del negocio.
 */
export function equilibrioPorSucursal({ businessId, estadoBase, mesObjetivo, obligaciones = [], calendario = null } = {}) {
  if (!estadoBase?.unidades || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mesObjetivo || ""))) {
    return { calculable: false, faltantes: ["estado de resultados base y mes objetivo"] };
  }
  const generalesObligacion = gastosFijosDelMes(obligacionesDe(obligaciones, businessId, null), mesObjetivo);
  const generalesDevengados = generalesObligacion.total ?? estadoBase.generales?.devengado ?? null;
  const ventasConocidas = estadoBase.unidades.filter((u) => u.ingresos !== null).reduce((s, u) => s + u.ingresos, 0);

  const sucursales = estadoBase.unidades.filter((u) => u.tipo === "sucursal").map((u) => {
    const faltantes = [];
    const avisos = [];
    // Margen de contribución variable: utilidad bruta menos gastos de venta, sobre ingresos.
    const m = u.ingresos && u.utilidadBruta !== null ? (u.utilidadBruta - (u.gastosVentaTotal || 0)) / u.ingresos : null;
    if (m === null) faltantes.push(`margen del mes base ${estadoBase.mes} (cobertura o costo incompletos)`);
    else if (m <= 0) faltantes.push("margen de contribución no positivo: ninguna venta cubre los gastos");

    const fijos = gastosFijosDelMes(obligacionesDe(obligaciones, businessId, u.unidad), mesObjetivo);
    // Devengo del mes objetivo: obligaciones de la sucursal; lo que no tiene
    // obligación se toma de lo pagado en el mes base (marcado).
    const categoriasConObligacion = new Set(Object.keys(fijos.porCategoria));
    const sinObligacion = (u.gastosDirectos?.porCategoria || []).filter((f) => !categoriasConObligacion.has(f.categoria));
    const extra = sinObligacion.reduce((s, f) => s + (f.pagado || 0), 0);
    if (sinObligacion.length) avisos.push(`Sin obligación registrada para ${sinObligacion.map((f) => f.categoria.toLowerCase()).join(", ")}: se usa lo pagado en ${estadoBase.mes}.`);
    const devengado = u.gastosDirectos || Object.keys(fijos.porCategoria).length
      ? Object.values(fijos.porCategoria).reduce((acc, v) => acc + v, 0) + extra
      : null;
    if (devengado === null) faltantes.push("gastos de la sucursal (Tesorería u obligaciones)");
    const vence = fijos.venceOperativo === null || fijos.venceOperativo === undefined ? null : fijos.venceOperativo + extra;
    if (!fijos.completo) avisos.push(...fijos.faltantes);

    // Calendario del mes objetivo calculado sin "hoy": todos sus días en
    // vigencia menos los cierres registrados (pasados o programados).
    const cal = calendario?.[u.unidad] || null;
    const diasObjetivo = cal ? cal.diasConVentaEsperada.length : diasMes(mesObjetivo);
    if (!cal) avisos.push("Sin calendario operativo: se usan todos los días del mes.");

    const share = u.ingresos !== null && ventasConocidas > 0 ? u.ingresos / ventasConocidas : null;
    const generalesAsignados = generalesDevengados !== null && share !== null ? generalesDevengados * share : null;

    const bloque = (gasto) => {
      if (m === null || m <= 0 || gasto === null || !diasObjetivo) return null;
      const ventaMensual = gasto / m;
      const ventaDiaria = ventaMensual / diasObjetivo;
      return {
        ventaMensual: r2(ventaMensual),
        ventaDiaria: r2(ventaDiaria),
        brechaDiaria: u.ventaPromedioDiaria === null ? null : r2(u.ventaPromedioDiaria - ventaDiaria),
      };
    };
    return {
      unidad: u.unidad,
      nombre: u.nombre,
      mesBase: estadoBase.mes,
      mesObjetivo,
      ventaDiariaActual: u.ventaPromedioDiaria,
      margenContribucionPct: r1(m === null ? null : m * 100),
      diasConVentaEsperada: diasObjetivo,
      gastosDirectosDevengados: r2(devengado),
      gastosDirectosQueVencen: r2(vence),
      generalesAsignados: r2(generalesAsignados),
      operativo: bloque(devengado),
      operativoConGenerales: generalesAsignados === null ? null : { tipo: "SUPUESTO", nota: "Generales repartidos por ventas.", ...bloque(devengado === null ? null : devengado + generalesAsignados) },
      efectivo: bloque(vence),
      faltantes,
      avisos,
    };
  });

  return {
    calculable: sucursales.some((s) => s.operativo !== null),
    tipo: "ESTIMACION",
    mesBase: estadoBase.mes,
    mesObjetivo,
    sucursales,
    generalesDevengados: r2(generalesDevengados),
    nota: "La deuda y los impuestos son del negocio: ver el equilibrio consolidado.",
  };
}

/*
 * Qué gastos pesan más: categorías devengadas por unidad y en total, en %
 * de los ingresos y en días de venta que se comen.
 */
export function gastosQueMasPesan(estado) {
  if (!estado?.unidades) return [];
  const filas = [];
  const agregar = (unidad, nombre, bloque, ingresos, ventaDiaria) => {
    for (const f of bloque?.porCategoria || []) {
      if (!f.devengado) continue;
      filas.push({
        unidad, nombre, categoria: f.categoria, devengado: f.devengado, pagado: f.pagado, pendiente: f.pendiente,
        pctIngresos: ingresos ? r1((f.devengado / ingresos) * 100) : null,
        diasDeVenta: ventaDiaria ? r1(f.devengado / ventaDiaria) : null,
      });
    }
  };
  for (const u of estado.unidades) agregar(u.unidad, u.nombre, u.gastosDirectos, u.ingresos, u.ventaPromedioDiaria);
  const ingresosTotales = estado.consolidado?.ingresos ?? estado.subtotalConocido?.ingresos?.valor ?? null;
  agregar("generales", "Generales", estado.generales, ingresosTotales, null);
  return filas.sort((a, b) => b.devengado - a.devengado);
}
