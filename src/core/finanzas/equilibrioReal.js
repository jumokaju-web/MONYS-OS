/*
 * PUNTO DE EQUILIBRIO CON DATOS REALES · MONYS OS
 *
 * Arma los datos del simulador existente (calcularEquilibrioDiario) desde
 * lo que el negocio ya registró, sin duplicar la fórmula:
 *   gastosFijos  ← obligaciones_operativas recurrentes (normalizadas a mes)
 *                  + obligaciones únicas que vencen en el mes elegido
 *   deuda        ← pago_mensual de deudas_financieras abiertas
 *   margenBruto  ← utilidad ÷ venta de "Ventas por artículo" (SICAR)
 *   ventaPrevista← venta diaria real de cada sucursal × días abiertos
 *   variablePorcentaje y diasAbiertos ← captura del usuario (no existen
 *                  en los datos; no se asumen)
 *
 * Reglas: lo que falta se reporta en faltantes y el campo queda "" (el
 * simulador lo trata como pendiente); nunca se rellena con 0. Todo es
 * estimación con fuente y periodo. Módulo puro.
 */
import { calcularEquilibrioDiario } from "../../features/inteligencia/utils/equilibrioDiario.js";

export const FACTOR_MENSUAL = Object.freeze({
  SEMANAL: 52 / 12,
  QUINCENAL: 2,
  MENSUAL: 1,
  BIMESTRAL: 1 / 2,
  TRIMESTRAL: 1 / 3,
  SEMESTRAL: 1 / 6,
  ANUAL: 1 / 12,
});

// Gastos que todo negocio con tienda tiene; si no están, falta capturarlos.
export const CATEGORIAS_FIJAS_CLAVE = Object.freeze(["RENTA", "NOMINA", "SERVICIOS"]);

const ESTADOS_DEUDA_ABIERTA = new Set(["ACTIVA", "REESTRUCTURADA"]);

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

function mesValido(mes) {
  return typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export function diasDelMes(mes) {
  if (!mesValido(mes)) return null;
  const [ano, numeroMes] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
}

/*
 * Gastos fijos del mes desde obligaciones operativas.
 * - Recurrentes: importe × factor mensual de su frecuencia.
 * - Únicas: solo si vencen dentro del mes elegido.
 * - Canceladas no cuentan. Importe o frecuencia inválidos → incompleto.
 */
export function gastosFijosDelMes(obligaciones = [], mes) {
  const porCategoria = {};
  const invalidas = [];
  let total = 0;
  let consideradas = 0;

  for (const obligacion of obligaciones || []) {
    if (String(obligacion?.estado || "").toUpperCase() === "CANCELADA") continue;
    const importe = numero(obligacion?.importe);
    const frecuencia = String(obligacion?.frecuencia || "UNICA").toUpperCase();
    const nombre = obligacion?.concepto || obligacion?.categoria || "obligación";

    if (importe === null || importe <= 0) {
      invalidas.push(`importe de ${nombre}`);
      continue;
    }

    let mensual = null;
    if (frecuencia === "UNICA") {
      const vence = String(obligacion?.fecha_vencimiento || "").slice(0, 7);
      if (!mesValido(vence)) {
        invalidas.push(`fecha de vencimiento de ${nombre}`);
        continue;
      }
      if (vence !== mes) continue;
      mensual = importe;
    } else if (FACTOR_MENSUAL[frecuencia]) {
      mensual = importe * FACTOR_MENSUAL[frecuencia];
    } else {
      invalidas.push(`frecuencia de ${nombre}`);
      continue;
    }

    const categoria = String(obligacion?.categoria || "OTRO").toUpperCase();
    porCategoria[categoria] = redondear((porCategoria[categoria] || 0) + mensual);
    total += mensual;
    consideradas += 1;
  }

  const categoriasFaltantes = CATEGORIAS_FIJAS_CLAVE.filter((categoria) => !porCategoria[categoria]);
  const completo = invalidas.length === 0 && categoriasFaltantes.length === 0;

  return {
    total: completo ? redondear(total) : null,
    totalCapturado: redondear(total),
    porCategoria,
    consideradas,
    completo,
    faltantes: [
      ...invalidas,
      ...categoriasFaltantes.map((categoria) => `gasto de ${categoria.toLowerCase()} (no capturado)`),
    ],
  };
}

/*
 * Pagos de deuda del mes: suma de pago_mensual de deudas abiertas.
 * Sin deudas abiertas registradas, el pago es 0 solo si se confirmó
 * (sinDeudasConfirmado); si no, queda pendiente.
 */
export function pagosDeudaDelMes(deudas = [], { sinDeudasConfirmado = false } = {}) {
  const abiertas = (deudas || []).filter((deuda) =>
    ESTADOS_DEUDA_ABIERTA.has(String(deuda?.estado || "").trim().toUpperCase())
  );
  if (!abiertas.length) {
    return sinDeudasConfirmado
      ? { total: 0, completo: true, faltantes: [], deudas: 0 }
      : { total: null, completo: false, faltantes: ["confirmar que no hay deudas abiertas"], deudas: 0 };
  }

  const faltantes = [];
  let total = 0;
  for (const deuda of abiertas) {
    const pago = numero(deuda?.pago_mensual);
    if (pago === null || pago < 0) {
      faltantes.push(`pago mensual de ${deuda?.nombre || deuda?.acreedor || "deuda"}`);
      continue;
    }
    total += pago;
  }
  return {
    total: faltantes.length ? null : redondear(total),
    totalCapturado: redondear(total),
    completo: faltantes.length === 0,
    faltantes,
    deudas: abiertas.length,
  };
}

// Mismo criterio que el motor de impacto (#160): la bandera false gana y
// un cero solo es dato con su bandera en true.
function confiable(valor, disponible) {
  if (disponible === false || valor === null) return false;
  if (valor === 0) return disponible === true;
  return true;
}

function diasDelPeriodo(periodo) {
  const inicio = new Date(periodo?.fechaInicio);
  const fin = new Date(periodo?.fechaFin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin < inicio) return null;
  const inicioDia = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  const finDia = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());
  return Math.round((finDia - inicioDia) / 86400000) + 1;
}

/*
 * Venta diaria y margen bruto desde el último "Ventas por artículo" de
 * cada sucursal del negocio.
 * - Venta diaria del negocio = suma de (venta ÷ días del periodo) por
 *   sucursal; una sucursal sin reporte deja el dato incompleto.
 * - Margen = utilidad ÷ venta, solo si todas las filas con venta traen
 *   utilidad confiable (cobertura completa).
 */
export function ventasYMargen(ventasPorSucursal = [], sucursales = []) {
  const porBranch = new Map((ventasPorSucursal || []).map((item) => [String(item?.branch_id), item]));
  const faltantes = [];
  const detalle = [];
  let ventaDiaria = 0;
  let importeTotal = 0;
  let importeConUtilidad = 0;
  let utilidadTotal = 0;
  let ventasCompletas = true;

  for (const sucursal of sucursales || []) {
    const nombre = sucursal?.name || sucursal?.nombre || "Sucursal";
    const registro = porBranch.get(String(sucursal?.id));
    if (!registro) {
      faltantes.push(`reporte Ventas por artículo de ${nombre}`);
      ventasCompletas = false;
      continue;
    }
    const dias = diasDelPeriodo(registro.periodo);
    if (!dias) {
      faltantes.push(`periodo del reporte de ${nombre}`);
      ventasCompletas = false;
      continue;
    }

    let importeSucursal = 0;
    let filasSinImporte = 0;
    for (const venta of registro.ventas || []) {
      const importe = numero(venta?.importe);
      if (!confiable(importe, venta?.importeDisponible) || importe < 0) {
        filasSinImporte += 1;
        continue;
      }
      importeSucursal += importe;
      const utilidad = numero(venta?.utilidad);
      if (confiable(utilidad, venta?.utilidadDisponible)) {
        importeConUtilidad += importe;
        utilidadTotal += utilidad;
      }
    }
    if (filasSinImporte > 0) {
      faltantes.push(`importe de ${filasSinImporte} venta(s) en ${nombre}`);
      ventasCompletas = false;
    }
    importeTotal += importeSucursal;
    ventaDiaria += importeSucursal / dias;
    detalle.push({
      branchId: sucursal.id,
      sucursal: nombre,
      dias,
      venta: redondear(importeSucursal),
      ventaDiaria: redondear(importeSucursal / dias),
      periodo: registro.periodo,
    });
  }

  const coberturaUtilidad = importeTotal > 0 ? importeConUtilidad / importeTotal : 0;
  const margenCompleto = ventasCompletas && importeTotal > 0 && coberturaUtilidad === 1;
  if (importeTotal > 0 && coberturaUtilidad < 1) {
    faltantes.push(`utilidad en ${Math.round((1 - coberturaUtilidad) * 100)}% de la venta`);
  }

  return {
    ventaDiaria: ventasCompletas && (sucursales || []).length > 0 ? redondear(ventaDiaria) : null,
    margenBruto: margenCompleto ? Math.round((utilidadTotal / importeTotal) * 10000) / 100 : null,
    coberturaUtilidad: Math.round(coberturaUtilidad * 1000) / 1000,
    detalle,
    faltantes,
  };
}

const texto = (valor) => (valor === null || valor === undefined ? "" : String(valor));

/*
 * Precarga del escenario "Base" del simulador con datos reales.
 * datos: mismos campos que EquilibrioDiario (textos; "" = pendiente).
 */
export function construirEquilibrioReal({
  mes,
  obligaciones = [],
  deudas = [],
  sinDeudasConfirmado = false,
  ventasPorSucursal = [],
  sucursales = [],
  diasAbiertos = null,
  variablePorcentaje = null,
  conciliacion = null,
} = {}) {
  const faltantes = [];
  const maximoDias = diasDelMes(mes);
  if (!maximoDias) faltantes.push("mes del escenario");

  const dias = numero(diasAbiertos);
  const diasValidos = dias !== null && Number.isInteger(dias) && dias >= 1 && (!maximoDias || dias <= maximoDias);
  if (!diasValidos) faltantes.push("días que abrirás en el mes");

  const variable = numero(variablePorcentaje);
  const variableValido = variable !== null && variable >= 0 && variable <= 100;
  if (!variableValido) faltantes.push("costos variables sobre ventas (comisiones, cobro con tarjeta)");

  const gastos = gastosFijosDelMes(obligaciones, mes);
  const deuda = pagosDeudaDelMes(deudas, { sinDeudasConfirmado });
  const ventas = ventasYMargen(ventasPorSucursal, sucursales);
  faltantes.push(...gastos.faltantes, ...deuda.faltantes, ...ventas.faltantes);

  const ventaPrevista = ventas.ventaDiaria !== null && diasValidos ? redondear(ventas.ventaDiaria * dias) : null;

  const datos = {
    gastosFijos: texto(gastos.total),
    margenBruto: texto(ventas.margenBruto),
    variablePorcentaje: variableValido ? texto(variable) : "",
    diasAbiertos: diasValidos ? texto(dias) : "",
    deuda: texto(deuda.total),
    ventaPrevista: texto(ventaPrevista),
  };
  const resultado = calcularEquilibrioDiario(datos);

  const calculable = resultado.calculable && faltantes.length === 0;
  // Confianza: nunca "alta" si falta algún dato; sin conciliación del mes
  // (pagos reales contra obligaciones) es "baja".
  const motivosConfianza = [];
  let confianza;
  if (!calculable) {
    confianza = "baja";
    motivosConfianza.push("Faltan datos para calcular el equilibrio.");
  } else if (!conciliacion) {
    confianza = "baja";
    motivosConfianza.push("Sin conciliación de gastos del mes: los gastos son los registrados como obligación, no los pagados.");
  } else {
    confianza = conciliacion.confianza;
    motivosConfianza.push(...(conciliacion.motivosConfianza || []));
  }

  return {
    tipo: "ESTIMACION",
    confianza,
    motivosConfianza,
    mes: mesValido(mes) ? mes : "",
    datos,
    calculable,
    resultado: resultado.calculable ? resultado : null,
    faltantes,
    fuentes: {
      gastosFijos: { origen: "obligaciones_operativas", porCategoria: gastos.porCategoria, consideradas: gastos.consideradas, totalCapturado: gastos.totalCapturado },
      deuda: { origen: "deudas_financieras", deudasAbiertas: deuda.deudas, totalCapturado: deuda.totalCapturado ?? deuda.total },
      ventas: { origen: "SICAR · Ventas por artículo", sucursales: ventas.detalle, coberturaUtilidad: ventas.coberturaUtilidad },
      conciliacion: conciliacion
        ? {
            origen: "cash_movements del mes",
            gastoOperativoReal: conciliacion.gastoOperativoReal,
            diferencias: conciliacion.diferencias,
            sinClasificar: conciliacion.sinClasificar.length,
          }
        : null,
    },
    supuestos: [
      "Las obligaciones recurrentes se convierten a su equivalente mensual; las únicas solo cuentan si vencen en el mes.",
      "Si un gasto recurrente también se registró como obligación única del mes, se contaría dos veces: revisa duplicados.",
      "La venta prevista repite la venta diaria del último reporte SICAR de cada sucursal; no incluye temporada ni campañas.",
      "No incluye compras de inventario, impuestos adicionales ni desfases de cobro: revísalos en el flujo de 13 semanas.",
    ],
  };
}
