/*
 * PUNTO DE EQUILIBRIO CON DATOS REALES · MONYS OS
 *
 * Tres indicadores independientes (todos ESTIMACIÓN):
 *  1. Equilibrio operativo: venta que cubre gastos fijos de operación.
 *     Sin deuda ni impuestos.
 *  2. Equilibrio de efectivo: operación + servicio de deuda (capital e
 *     intereses) + impuestos programados. Es caja, no utilidad.
 *  3. Utilidad neta estimada: contribución − gastos fijos − intereses.
 *     El capital de la deuda NO es gasto; los impuestos se reportan aparte
 *     porque sin su tipo (IVA, ISR, IMSS, periodos anteriores) no se sabe
 *     si son gasto del periodo.
 *
 * Gastos: se distinguen
 *  - devengo mensual estimado (costo prorrateado del mes: semanal × 52/12),
 *  - vencimientos del mes (fechas de pago en el calendario; caja),
 *  - pagado (conciliación de caja) y pendiente.
 *
 * Reutiliza calcularEquilibrioDiario (simulador existente) para los
 * indicadores 1 y 2. Lo faltante queda "" y listado; nunca 0.
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

const MESES_POR_FRECUENCIA = { MENSUAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

// Gastos de operación que todo negocio con tienda tiene.
export const CATEGORIAS_FIJAS_CLAVE = Object.freeze(["RENTA", "NOMINA", "SERVICIOS"]);
// Categorías de obligación que no son gasto operativo.
const CATEGORIAS_NO_OPERATIVAS = new Set(["IMPUESTOS"]);

const ESTADOS_DEUDA_ABIERTA = new Set(["ACTIVA", "REESTRUCTURADA"]);
export const NIVELES_CONFIANZA = Object.freeze(["baja", "media", "alta"]);

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

function fechaUTC(texto) {
  const valor = String(texto || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const fecha = new Date(`${valor}T12:00:00Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor ? null : fecha;
}

/*
 * Cuántos vencimientos de una obligación caen dentro del mes, a partir de
 * su fecha_vencimiento como ancla del calendario.
 */
/*
 * Fechas (YYYY-MM-DD) en que una obligación vence dentro del mes. Es la
 * única fuente: vencimientosEnMes es su conteo.
 * - UNICA: su fecha, si cae en el mes.
 * - QUINCENAL (México): día 15 y último día del mes.
 * - SEMANAL: cada 7 días desde la fecha ancla.
 * - MENSUAL/BIMESTRAL/…: el día de la fecha ancla (o el último día si el
 *   mes es más corto), en los meses que le tocan.
 * null si la obligación no tiene fecha o frecuencia válida.
 */
export function fechasDeVencimientoEnMes(obligacion, mes) {
  const frecuencia = String(obligacion?.frecuencia || "UNICA").toUpperCase();
  const ancla = fechaUTC(obligacion?.fecha_vencimiento);
  if (!mesValido(mes) || !ancla) return null;
  const [ano, numeroMes] = mes.split("-").map(Number);
  const inicio = Date.UTC(ano, numeroMes - 1, 1, 12);
  const fin = Date.UTC(ano, numeroMes, 0, 12);
  const ultimoDia = new Date(fin).getUTCDate();
  const dia = (d) => `${mes}-${String(d).padStart(2, "0")}`;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);

  if (frecuencia === "UNICA") return ancla.getTime() >= inicio && ancla.getTime() <= fin ? [iso(ancla.getTime())] : [];
  if (frecuencia === "QUINCENAL") return [dia(15), dia(ultimoDia)];
  if (frecuencia === "SEMANAL") {
    const paso = 7 * 86400000;
    let fecha = ancla.getTime();
    while (fecha > inicio) fecha -= paso;
    while (fecha < inicio) fecha += paso;
    const fechas = [];
    for (; fecha <= fin; fecha += paso) fechas.push(iso(fecha));
    return fechas;
  }
  const meses = MESES_POR_FRECUENCIA[frecuencia];
  if (!meses) return null;
  const diferencia = (ano - ancla.getUTCFullYear()) * 12 + (numeroMes - 1 - ancla.getUTCMonth());
  return ((diferencia % meses) + meses) % meses === 0 ? [dia(Math.min(ancla.getUTCDate(), ultimoDia))] : [];
}

export function vencimientosEnMes(obligacion, mes) {
  const fechas = fechasDeVencimientoEnMes(obligacion, mes);
  return fechas === null ? null : fechas.length;
}

export function gastosFijosDelMes(obligaciones = [], mes) {
  const porCategoria = {};
  const vencePorCategoria = {};
  const invalidas = [];
  let presupuestoOperativo = 0;
  let venceOperativo = 0;
  let presupuestoImpuestos = 0;
  let venceImpuestos = 0;
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
    if (frecuencia !== "UNICA" && !FACTOR_MENSUAL[frecuencia]) {
      invalidas.push(`frecuencia de ${nombre}`);
      continue;
    }
    const vencimientos = vencimientosEnMes(obligacion, mes);
    if (vencimientos === null) {
      invalidas.push(`fecha de vencimiento de ${nombre}`);
      continue;
    }

    const presupuesto = frecuencia === "UNICA" ? (vencimientos ? importe : 0) : importe * FACTOR_MENSUAL[frecuencia];
    const vence = importe * vencimientos;
    if (!presupuesto && !vence) continue;

    const categoria = String(obligacion?.categoria || "OTRO").toUpperCase();
    porCategoria[categoria] = redondear((porCategoria[categoria] || 0) + presupuesto);
    vencePorCategoria[categoria] = redondear((vencePorCategoria[categoria] || 0) + vence);
    if (CATEGORIAS_NO_OPERATIVAS.has(categoria)) {
      presupuestoImpuestos += presupuesto;
      venceImpuestos += vence;
    } else {
      presupuestoOperativo += presupuesto;
      venceOperativo += vence;
    }
    consideradas += 1;
  }

  const categoriasFaltantes = CATEGORIAS_FIJAS_CLAVE.filter((categoria) => !porCategoria[categoria]);
  const completo = invalidas.length === 0 && categoriasFaltantes.length === 0;

  return {
    total: completo ? redondear(presupuestoOperativo) : null,
    totalCapturado: redondear(presupuestoOperativo),
    venceOperativo: completo ? redondear(venceOperativo) : null,
    impuestosPresupuesto: redondear(presupuestoImpuestos),
    impuestosQueVencen: redondear(venceImpuestos),
    porCategoria,
    vencePorCategoria,
    consideradas,
    completo,
    faltantes: [
      ...invalidas,
      ...categoriasFaltantes.map((categoria) => `gasto de ${categoria.toLowerCase()} (no capturado)`),
    ],
  };
}

/*
 * Servicio de deuda del mes, separando intereses (gasto) de capital (no
 * gasto). Interés estimado = saldo × tasa anual ÷ 12; capital = pago
 * mensual − interés. Sin tasa no se puede separar.
 */
export function pagosDeudaDelMes(deudas = [], { sinDeudasConfirmado = false } = {}) {
  const abiertas = (deudas || []).filter((deuda) =>
    ESTADOS_DEUDA_ABIERTA.has(String(deuda?.estado || "").trim().toUpperCase())
  );
  if (!abiertas.length) {
    return sinDeudasConfirmado
      ? { total: 0, intereses: 0, capital: 0, interesNoCubierto: 0, completo: true, interesesCompletos: true, faltantes: [], avisos: [], deudas: 0 }
      : { total: null, intereses: null, capital: null, interesNoCubierto: null, completo: false, interesesCompletos: false, faltantes: ["confirmar que no hay deudas abiertas"], avisos: [], deudas: 0 };
  }

  const faltantes = [];
  const avisos = [];
  let total = 0;
  let intereses = 0;
  let capital = 0;
  let interesNoCubierto = 0;
  let interesesCompletos = true;
  for (const deuda of abiertas) {
    const nombre = deuda?.nombre || deuda?.acreedor || "deuda";
    const pago = numero(deuda?.pago_mensual);
    const saldo = numero(deuda?.saldo_actual);
    const tasa = numero(deuda?.tasa_anual);
    if (pago === null || pago < 0) {
      faltantes.push(`pago mensual de ${nombre}`);
      interesesCompletos = false;
      continue;
    }
    total += pago;
    if (saldo === null || saldo < 0 || tasa === null || tasa < 0) {
      faltantes.push(`tasa y saldo de ${nombre} para separar intereses de capital`);
      interesesCompletos = false;
      continue;
    }
    // El interés se devenga completo aunque el pago no lo cubra.
    const interesDelMes = saldo * (tasa / 100) / 12;
    intereses += interesDelMes;
    capital += Math.max(0, pago - interesDelMes);
    if (pago < interesDelMes) {
      interesNoCubierto += interesDelMes - pago;
      avisos.push(`El pago de ${nombre} no cubre el interés del mes: la deuda crece ${redondear(interesDelMes - pago)}.`);
    }
  }
  const completo = !faltantes.some((texto) => texto.startsWith("pago mensual"));
  return {
    total: completo ? redondear(total) : null,
    totalCapturado: redondear(total),
    intereses: interesesCompletos ? redondear(intereses) : null,
    capital: interesesCompletos && completo ? redondear(capital) : null,
    interesNoCubierto: interesesCompletos ? redondear(interesNoCubierto) : null,
    completo,
    interesesCompletos,
    faltantes,
    avisos,
    deudas: abiertas.length,
  };
}

// Mismo criterio que el motor de impacto: la bandera false gana y un cero
// solo es dato con su bandera en true.
function confiable(valor, disponible) {
  if (disponible === false || valor === null) return false;
  if (valor === 0) return disponible === true;
  return true;
}

function rangoPeriodo(periodo) {
  const inicio = new Date(periodo?.fechaInicio);
  const fin = new Date(periodo?.fechaFin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin < inicio) return null;
  const inicioDia = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  const finDia = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());
  return { dias: Math.round((finDia - inicioDia) / 86400000) + 1, inicio: inicioDia, fin: finDia };
}

/*
 * Venta diaria y margen bruto desde el último "Ventas por artículo" de
 * cada sucursal.
 * - diasAbiertosPeriodo[branchId]: días que la sucursal realmente abrió en
 *   el periodo del reporte (si cerró días, la venta diaria se calcula sobre
 *   días abiertos). Sin ese dato se usan los días naturales del periodo y
 *   se marca como no confirmado.
 * - Margen solo con cobertura completa de utilidad.
 * - Periodos de distinta duración o fin se marcan como no comparables.
 */
export function ventasYMargen(ventasPorSucursal = [], sucursales = [], { diasAbiertosPeriodo = {} } = {}) {
  const porBranch = new Map((ventasPorSucursal || []).map((item) => [String(item?.branch_id), item]));
  const faltantes = [];
  const avisos = [];
  const detalle = [];
  let importeTotal = 0;
  let importeConUtilidad = 0;
  let utilidadTotal = 0;
  let ventasCompletas = true;
  let banderasDesconocidas = 0;
  let filas = 0;

  for (const sucursal of sucursales || []) {
    const nombre = sucursal?.name || sucursal?.nombre || "Sucursal";
    const registro = porBranch.get(String(sucursal?.id));
    if (!registro) {
      faltantes.push(`reporte Ventas por artículo de ${nombre}`);
      ventasCompletas = false;
      continue;
    }
    const rango = rangoPeriodo(registro.periodo);
    if (!rango) {
      faltantes.push(`periodo del reporte de ${nombre}`);
      ventasCompletas = false;
      continue;
    }
    const diasConfirmados = numero(diasAbiertosPeriodo?.[sucursal.id]);
    const diasValidos = diasConfirmados !== null && Number.isInteger(diasConfirmados) && diasConfirmados >= 1 && diasConfirmados <= rango.dias;
    if (diasConfirmados !== null && !diasValidos) {
      faltantes.push(`días abiertos válidos de ${nombre} en el periodo (1 a ${rango.dias})`);
      ventasCompletas = false;
      continue;
    }
    if (!diasValidos) avisos.push(`días abiertos de ${nombre} en el periodo no confirmados: se usaron ${rango.dias} días naturales`);
    const dias = diasValidos ? diasConfirmados : rango.dias;

    let importeSucursal = 0;
    let filasSinImporte = 0;
    for (const venta of registro.ventas || []) {
      filas += 1;
      if (venta?.utilidadDisponible == null || venta?.importeDisponible == null) banderasDesconocidas += 1;
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
    detalle.push({
      branchId: sucursal.id,
      sucursal: nombre,
      diasPeriodo: rango.dias,
      diasAbiertos: dias,
      diasConfirmados: diasValidos,
      venta: redondear(importeSucursal),
      ventaDiaria: redondear(importeSucursal / dias),
      periodo: registro.periodo,
      _rango: rango,
    });
  }

  const duraciones = new Set(detalle.map((fila) => fila._rango.dias));
  const finales = new Set(detalle.map((fila) => fila._rango.fin));
  const comparables = duraciones.size <= 1 && finales.size <= 1;
  if (!comparables) avisos.push("los periodos de venta de las sucursales no son comparables (distinta duración o fecha final)");
  if (banderasDesconocidas > 0) avisos.push(`${banderasDesconocidas} de ${filas} ventas sin banderas de disponibilidad (importación anterior a #164)`);

  const coberturaUtilidad = importeTotal > 0 ? importeConUtilidad / importeTotal : 0;
  const margenCompleto = ventasCompletas && importeTotal > 0 && coberturaUtilidad === 1;
  if (importeTotal > 0 && coberturaUtilidad < 1) {
    faltantes.push(`utilidad en ${Math.round((1 - coberturaUtilidad) * 100)}% de la venta`);
  }

  return {
    margenBruto: margenCompleto ? Math.round((utilidadTotal / importeTotal) * 10000) / 100 : null,
    coberturaUtilidad: Math.round(coberturaUtilidad * 1000) / 1000,
    ventasCompletas: ventasCompletas && (sucursales || []).length > 0,
    comparables,
    banderasDesconocidas,
    detalle: detalle.map(({ _rango, ...fila }) => fila),
    faltantes,
    avisos,
  };
}

const texto = (valor) => (valor === null || valor === undefined ? "" : String(valor));

function enteroEn(valor, minimo, maximo) {
  const convertido = numero(valor);
  return convertido !== null && Number.isInteger(convertido) && convertido >= minimo && convertido <= maximo ? convertido : null;
}

function mesAbierto(mes, hoy) {
  if (!mesValido(mes)) return false;
  const referencia = hoy ? new Date(hoy) : new Date();
  const local = new Date(referencia.getTime() - 6 * 3600 * 1000);
  return local.toISOString().slice(0, 7) <= mes;
}

/*
 * Arma los tres indicadores.
 * diasAbiertos: días del mes que opera el negocio (meta diaria).
 * diasAbiertosMes: { branchId: días que abrirá cada sucursal en el mes }
 *   (venta prevista = Σ venta diaria × días de cada sucursal).
 * diasAbiertosPeriodo: { branchId: días que abrió en el periodo del
 *   reporte SICAR } (venta diaria sobre días abiertos).
 */
export function construirEquilibrioReal({
  businessId = null,
  mes,
  hoy = null,
  obligaciones = [],
  deudas = [],
  sinDeudasConfirmado = false,
  ventasPorSucursal = [],
  sucursales = [],
  diasAbiertos = null,
  diasAbiertosMes = {},
  diasAbiertosPeriodo = {},
  variablePorcentaje = null,
  conciliacion = null,
  descartados = 0,
} = {}) {
  const faltantes = [];
  const maximoDias = diasDelMes(mes);
  if (!maximoDias) faltantes.push("mes del escenario");

  const dias = enteroEn(diasAbiertos, 1, maximoDias || 31);
  if (dias === null) faltantes.push("días que abrirá el negocio en el mes");

  const variable = numero(variablePorcentaje);
  const variableValido = variable !== null && variable >= 0 && variable <= 100;
  if (!variableValido) faltantes.push("costos variables sobre ventas (comisiones, cobro con tarjeta)");

  const gastos = gastosFijosDelMes(obligaciones, mes);
  const deuda = pagosDeudaDelMes(deudas, { sinDeudasConfirmado });
  const ventas = ventasYMargen(ventasPorSucursal, sucursales, { diasAbiertosPeriodo });
  faltantes.push(...gastos.faltantes, ...deuda.faltantes, ...ventas.faltantes);

  // Venta prevista por sucursal con sus días abiertos del mes.
  let ventaPrevista = ventas.ventasCompletas && dias !== null ? 0 : null;
  const diasMesNoConfirmados = [];
  for (const fila of ventas.detalle) {
    const diasSucursal = enteroEn(diasAbiertosMes?.[fila.branchId], 0, maximoDias || 31);
    if (diasSucursal === null) diasMesNoConfirmados.push(fila.sucursal);
    if (ventaPrevista !== null) ventaPrevista += fila.ventaDiaria * (diasSucursal ?? dias);
  }
  if (ventaPrevista !== null) ventaPrevista = redondear(ventaPrevista);

  const baseSimulador = {
    gastosFijos: texto(gastos.total),
    margenBruto: texto(ventas.margenBruto),
    variablePorcentaje: variableValido ? texto(variable) : "",
    diasAbiertos: dias !== null ? texto(dias) : "",
    ventaPrevista: texto(ventaPrevista),
  };

  // 1. Operativo: sin deuda ni impuestos.
  const operativo = calcularEquilibrioDiario({ ...baseSimulador, deuda: "0" });
  // 2. Efectivo: servicio de deuda + impuestos programados del mes.
  const compromisosCaja =
    deuda.total === null ? null : redondear(deuda.total + gastos.impuestosQueVencen);
  const datos = { ...baseSimulador, deuda: texto(compromisosCaja) };
  const efectivo = calcularEquilibrioDiario(datos);
  // 3. Utilidad neta estimada: contribución − gastos fijos − intereses.
  let utilidadNeta = null;
  if (operativo.calculable && deuda.intereses !== null) {
    const contribucionPrevista = Number(baseSimulador.ventaPrevista) * operativo.contribucion;
    utilidadNeta = {
      concepto: "utilidad antes de ISR",
      utilidadAntesDeISR: redondear(contribucionPrevista - gastos.total - deuda.intereses),
      ventaParaUtilidadCero: redondear((gastos.total + deuda.intereses) / operativo.contribucion),
      interesesDevengadosEstimados: deuda.intereses,
      interesesPagados: conciliacion?.gastoFinanciero ?? null,
      interesNoCubierto: deuda.interesNoCubierto,
      capitalNoEsGasto: deuda.capital,
    };
  } else if (operativo.calculable) {
    faltantes.push("intereses de deuda separados de capital (tasa y saldo)");
  }

  const calculable = efectivo.calculable && faltantes.length === 0;

  // Confianza: nunca alta con información incompleta.
  const motivosConfianza = [];
  const topes = [];
  if (!operativo.calculable || faltantes.length) {
    topes.push("baja");
    motivosConfianza.push("Faltan datos para calcular los indicadores.");
  }
  if (!conciliacion) {
    topes.push("baja");
    motivosConfianza.push("Sin conciliación de caja del mes: los gastos son presupuesto, no pagos.");
  } else {
    topes.push(conciliacion.confianza);
    motivosConfianza.push(...(conciliacion.motivosConfianza || []));
  }
  if (mesAbierto(mes, hoy)) {
    topes.push("media");
    motivosConfianza.push("El mes aún no termina: pagos y ventas pueden cambiar.");
  }
  if (descartados > 0) {
    topes.push("media");
    motivosConfianza.push(`Se descartaron ${descartados} registros ajenos al negocio.`);
  }
  if (!ventas.comparables || ventas.banderasDesconocidas > 0 || ventas.detalle.some((fila) => !fila.diasConfirmados)) {
    topes.push("media");
    motivosConfianza.push(...ventas.avisos);
  }
  if (diasMesNoConfirmados.length) {
    topes.push("media");
    motivosConfianza.push(`Días abiertos del mes no confirmados para: ${diasMesNoConfirmados.join(", ")}.`);
  }
  motivosConfianza.push(...deuda.avisos);
  if (gastos.impuestosPresupuesto > 0) {
    motivosConfianza.push("Impuestos programados incluidos solo en efectivo: clasifica si son IVA, ISR, IMSS o de periodos anteriores.");
  }
  const confianza = NIVELES_CONFIANZA[Math.min(...topes.map((nivel) => NIVELES_CONFIANZA.indexOf(nivel)).concat(2))];

  return {
    tipo: "ESTIMACION",
    businessId,
    mes: mesValido(mes) ? mes : "",
    confianza,
    motivosConfianza,
    datos,
    calculable,
    indicadores: {
      operativo: operativo.calculable
        ? { ventaMensual: redondear(operativo.operacion), ventaDiaria: redondear(operativo.operacionDiaria), excedente: redondear(operativo.excedenteOperacion) }
        : null,
      efectivo: efectivo.calculable
        ? { ventaMensual: redondear(efectivo.caja), ventaDiaria: redondear(efectivo.cajaDiaria), compromisos: compromisosCaja, faltanteDiario: redondear(efectivo.brechaCajaDiaria) }
        : null,
      utilidadNeta,
    },
    resultado: efectivo.calculable ? efectivo : null,
    gastos: {
      devengoMensualEstimado: gastos.total,
      venceOperativoEnElMes: gastos.venceOperativo,
      impuestosQueVencen: gastos.impuestosQueVencen,
      pagadoOperativo: conciliacion?.gastoOperativoReal ?? null,
      pendientePorCategoria: conciliacion?.diferencias ?? null,
    },
    faltantes,
    fuentes: {
      gastosFijos: { origen: "obligaciones_operativas", porCategoria: gastos.porCategoria, vencePorCategoria: gastos.vencePorCategoria, consideradas: gastos.consideradas },
      deuda: { origen: "deudas_financieras", deudasAbiertas: deuda.deudas, servicio: deuda.total, intereses: deuda.intereses, capital: deuda.capital },
      ventas: { origen: "SICAR · Ventas por artículo", sucursales: ventas.detalle, coberturaUtilidad: ventas.coberturaUtilidad, comparables: ventas.comparables },
      conciliacion: conciliacion
        ? { origen: "cash_movements del mes", gastoOperativoReal: conciliacion.gastoOperativoReal, diferencias: conciliacion.diferencias, sinClasificar: conciliacion.sinClasificar.length }
        : null,
    },
    supuestos: [
      "Devengo mensual estimado = costo prorrateado de cada obligación recurrente (semanal × 52/12); vencimientos = fechas de pago que caen en el calendario del mes (caja). No son lo mismo.",
      "Intereses devengados estimados como saldo × tasa anual ÷ 12, se paguen o no; los pagados salen de la conciliación.",
      "El capital de la deuda no es gasto. Si el pago no cubre el interés, la deuda crece.",
      "La utilidad es antes de ISR.",
      "La venta prevista repite la venta diaria del último reporte SICAR de cada sucursal; no incluye temporada ni campañas.",
      "No incluye compras de inventario ni desfases de cobro: revísalos en el flujo de 13 semanas.",
    ],
  };
}

/*
 * Consolidado para la propietaria (p. ej. tienda + flotilla).
 * - Solo es válido con negocios únicos (businessId) y el mismo mes.
 * - Solo suma negocios calculables; sin ninguno, los totales son null.
 * - operacionesInternas: [{ pagador, receptor, importe }] pagos entre
 *   negocios del grupo (p. ej. la tienda paga a flotilla). Se eliminan:
 *   el gasto del pagador deja de requerir venta externa y la utilidad
 *   consolidada no cambia porque ingreso y gasto se cancelan (ambos lados
 *   deben estar registrados; si no, se avisa).
 */
export function consolidarEquilibrios(resultados = [], { operacionesInternas = [] } = {}) {
  const lista = (resultados || []).filter(Boolean);
  const problemas = [];
  const ids = lista.map((item) => item.businessId);
  if (ids.some((id) => !id)) problemas.push("Hay resultados sin negocio identificado.");
  if (new Set(ids).size !== ids.length) problemas.push("Hay negocios repetidos.");
  const meses = new Set(lista.map((item) => item.mes));
  if (meses.size > 1) problemas.push("Los resultados son de meses distintos.");

  const calculables = lista.filter((item) => item.resultado?.calculable && item.indicadores?.efectivo);
  const porNegocio = new Map(calculables.map((item) => [String(item.businessId), item]));

  // Venta externa que ya no hace falta por pagos internos del pagador.
  const ajustePorNegocio = new Map();
  for (const operacion of operacionesInternas || []) {
    const importe = numero(operacion?.importe);
    const pagador = porNegocio.get(String(operacion?.pagador));
    if (!pagador || !porNegocio.has(String(operacion?.receptor)) || importe === null || importe <= 0) {
      problemas.push("Hay operaciones internas con negocios fuera del consolidado o importes inválidos.");
      continue;
    }
    const contribucion = pagador.resultado.contribucion;
    ajustePorNegocio.set(String(operacion.pagador), (ajustePorNegocio.get(String(operacion.pagador)) || 0) + importe / contribucion);
  }

  const valido = problemas.length === 0 && calculables.length > 0;
  const suma = (lector, conAjuste = false) => {
    if (!valido) return null;
    const valores = calculables.map((item) => {
      const valor = lector(item);
      if (valor === null || valor === undefined) return null;
      return conAjuste ? valor - (ajustePorNegocio.get(String(item.businessId)) || 0) : valor;
    });
    return valores.some((valor) => valor === null) ? null : redondear(valores.reduce((a, b) => a + b, 0));
  };
  const indice = lista.length
    ? Math.min(...lista.map((item) => NIVELES_CONFIANZA.indexOf(item.confianza)).map((valor) => (valor < 0 ? 0 : valor)))
    : 0;

  return {
    tipo: "ESTIMACION",
    mes: meses.size === 1 ? [...meses][0] : null,
    negocios: lista.length,
    negociosIncluidos: calculables.length,
    negociosExcluidos: lista.length - calculables.length,
    completo: valido && calculables.length === lista.length,
    problemas,
    confianza: valido && calculables.length === lista.length ? NIVELES_CONFIANZA[indice] : "baja",
    operacionesInternasEliminadas: valido ? (operacionesInternas || []).length : 0,
    ventaMensualOperativa: suma((item) => item.indicadores.operativo?.ventaMensual, true),
    ventaMensualEfectivo: suma((item) => item.indicadores.efectivo?.ventaMensual, true),
    utilidadAntesDeISR: suma((item) => item.indicadores.utilidadNeta?.utilidadAntesDeISR),
  };
}
