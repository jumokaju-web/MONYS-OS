/*
 * CONCILIACIÓN DE GASTOS · MONYS OS
 *
 * No toda salida de caja es gasto ni toda entrada es venta. Cada
 * movimiento de cash_movements se clasifica por su naturaleza económica a
 * partir de lo que ya captura Tesorería (movement_type, expense_category,
 * expense_behavior). Luego se compara el gasto real del mes contra las
 * obligaciones registradas y se calcula el nivel de confianza que usa el
 * punto de equilibrio. Módulo puro.
 */
import { vencimientosEnMes } from "./equilibrioReal.js";

export const NATURALEZAS = Object.freeze({
  GASTO_FIJO: "gasto_operativo_fijo",
  GASTO_VARIABLE: "gasto_operativo_variable",
  NOMINA: "nomina",
  IMPUESTOS: "impuestos",
  COMISIONES: "comisiones",
  INTERESES: "intereses_deuda",
  CAPITAL_DEUDA: "pago_capital_deuda",
  IMPUESTO_IVA: "impuesto_iva",
  IMPUESTO_ISR: "impuesto_isr",
  COMPRA_INVENTARIO: "compra_inventario",
  RETIRO_PROPIETARIA: "retiro_propietaria",
  FINANCIAMIENTO: "financiamiento",
  TRASPASO: "traspaso",
  AJUSTE: "ajuste",
  VENTA_SICAR: "venta_registrada_sicar",
  COBRO_MARKETPLACE: "cobro_marketplace",
  SIN_CLASIFICAR: "sin_clasificar",
});

// Naturalezas que son gasto de operación (afectan utilidad operativa).
// Impuestos NO: un pago al SAT puede ser IVA (se traslada), ISR (impuesto
// a la utilidad) o de periodos anteriores; se reporta aparte.
export const NATURALEZAS_GASTO = new Set([
  NATURALEZAS.GASTO_FIJO,
  NATURALEZAS.GASTO_VARIABLE,
  NATURALEZAS.NOMINA,
  NATURALEZAS.COMISIONES,
]);

// Gasto financiero: afecta la utilidad neta, no la operativa.
export const NATURALEZAS_GASTO_FINANCIERO = new Set([NATURALEZAS.INTERESES]);

const CATEGORIA_A_NATURALEZA_SALIDA = {
  nomina: NATURALEZAS.NOMINA,
  cuotas_imss_infonavit: NATURALEZAS.NOMINA,
  impuestos: NATURALEZAS.IMPUESTOS,
  impuesto_iva: NATURALEZAS.IMPUESTO_IVA,
  impuesto_isr: NATURALEZAS.IMPUESTO_ISR,
  comisiones: NATURALEZAS.COMISIONES,
  comisiones_marketplace: NATURALEZAS.COMISIONES,
  intereses_deuda: NATURALEZAS.INTERESES,
  pago_capital_deuda: NATURALEZAS.CAPITAL_DEUDA,
  compras_inventario: NATURALEZAS.COMPRA_INVENTARIO,
  compra_mercancia: NATURALEZAS.COMPRA_INVENTARIO,
  retiro_propietaria: NATURALEZAS.RETIRO_PROPIETARIA,
  anticipo_prestamo: NATURALEZAS.FINANCIAMIENTO,
  traspaso_caja: NATURALEZAS.TRASPASO,
  ajuste_cancelacion: NATURALEZAS.AJUSTE,
  registro_prueba: NATURALEZAS.AJUSTE,
};

// Categorías de gasto operativo que dependen de si es fijo o variable.
const CATEGORIAS_OPERATIVAS = new Set([
  "renta",
  "servicios",
  "marketing",
  "transporte",
  "mantenimiento",
  "papeleria",
  "otro",
  "otros",
  "limpieza",
  "alimentos",
]);

const CATEGORIA_A_NATURALEZA_ENTRADA = {
  ingreso_caja_sicar: NATURALEZAS.VENTA_SICAR,
  // El depósito de un marketplace liquida ventas ya registradas (cuenta por
  // cobrar): no es venta adicional.
  liquidacion_marketplace: NATURALEZAS.COBRO_MARKETPLACE,
  traspaso_caja: NATURALEZAS.TRASPASO,
  anticipo_prestamo: NATURALEZAS.FINANCIAMIENTO,
  ajuste_cancelacion: NATURALEZAS.AJUSTE,
  registro_prueba: NATURALEZAS.AJUSTE,
};

// Equivalencia entre categoría de Tesorería y de obligaciones operativas.
const CATEGORIA_OBLIGACION = {
  renta: "RENTA",
  nomina: "NOMINA",
  servicios: "SERVICIOS",
  impuestos: "IMPUESTOS",
};

const texto = (valor) => String(valor ?? "").trim().toLowerCase();

function importeValido(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

/*
 * Naturaleza económica de un movimiento.
 * Devuelve { naturaleza, esGasto, motivo }.
 */
export function clasificarMovimiento(movimiento = {}) {
  const tipo = texto(movimiento.movement_type ?? movimiento.tipo);
  const categoria = texto(movimiento.expense_category ?? movimiento.categoria);
  const comportamiento = texto(movimiento.expense_behavior ?? movimiento.comportamiento);

  if (tipo === "entrada") {
    const naturaleza = CATEGORIA_A_NATURALEZA_ENTRADA[categoria] || NATURALEZAS.SIN_CLASIFICAR;
    return {
      naturaleza,
      esGasto: false,
      motivo:
        naturaleza === NATURALEZAS.SIN_CLASIFICAR
          ? "Entrada sin categoría: no se cuenta como venta hasta clasificarla."
          : "",
    };
  }

  if (tipo !== "salida") {
    return { naturaleza: NATURALEZAS.SIN_CLASIFICAR, esGasto: false, motivo: "Tipo de movimiento desconocido." };
  }

  if (!categoria || categoria === "sin_clasificar") {
    return { naturaleza: NATURALEZAS.SIN_CLASIFICAR, esGasto: false, motivo: "Salida sin categoría." };
  }

  if (CATEGORIA_A_NATURALEZA_SALIDA[categoria]) {
    const naturaleza = CATEGORIA_A_NATURALEZA_SALIDA[categoria];
    return { naturaleza, esGasto: NATURALEZAS_GASTO.has(naturaleza), motivo: "" };
  }

  if (CATEGORIAS_OPERATIVAS.has(categoria)) {
    if (comportamiento === "fijo") return { naturaleza: NATURALEZAS.GASTO_FIJO, esGasto: true, motivo: "" };
    if (comportamiento === "variable") return { naturaleza: NATURALEZAS.GASTO_VARIABLE, esGasto: true, motivo: "" };
    return {
      naturaleza: NATURALEZAS.SIN_CLASIFICAR,
      esGasto: false,
      motivo: "Gasto de operación sin indicar si es fijo o variable.",
    };
  }

  return { naturaleza: NATURALEZAS.SIN_CLASIFICAR, esGasto: false, motivo: `Categoría desconocida: ${categoria}.` };
}

function mesDe(fecha) {
  const valor = String(fecha ?? "");
  // occurred_at viene en UTC; se usa la fecha local de Ciudad de México.
  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return null;
  const local = new Date(parsed.getTime() - 6 * 3600 * 1000);
  return local.toISOString().slice(0, 7);
}

/*
 * Concilia los movimientos de un mes contra las obligaciones.
 *
 * - Se excluyen movimientos cancelados y de otros meses (fecha local CDMX).
 * - Totales por naturaleza. Gasto operativo pagado = NATURALEZAS_GASTO;
 *   intereses e impuestos van aparte. Sin movimientos, los pagados son
 *   null (no se sabe), no 0.
 * - Por categoría con obligación (renta, nómina, servicios, impuestos):
 *   devengado del mes (vencimientos del calendario) contra pagado y
 *   pendiente. Es una comparación por categoría: no prueba que cada
 *   obligación individual se haya pagado.
 * - Confianza (nunca alta con información incompleta):
 *   baja  = sin movimientos, movimientos sin clasificar u obligaciones
 *           incompletas;
 *   media = movimientos pendientes de revisión, pagos al SAT sin tipo o
 *           diferencias mayores a 10% por categoría;
 *   alta  = nada de lo anterior.
 */
export function conciliarGastosDelMes({ movimientos = [], obligaciones = [], mes, gastosFijos = null } = {}) {
  const porNaturaleza = {};
  const sinClasificar = [];
  let pendientesRevision = 0;
  let considerados = 0;
  let gastoOperativo = 0;
  let gastoFinanciero = 0;
  const pagadoPorCategoria = {};

  for (const movimiento of movimientos || []) {
    if (texto(movimiento?.status) === "cancelado") continue;
    if (mesDe(movimiento?.occurred_at) !== mes) continue;
    const importe = importeValido(movimiento?.amount);
    if (importe === null) {
      sinClasificar.push({ id: movimiento?.id, motivo: "Importe inválido." });
      continue;
    }
    considerados += 1;
    const { naturaleza, esGasto, motivo } = clasificarMovimiento(movimiento);
    porNaturaleza[naturaleza] = redondear((porNaturaleza[naturaleza] || 0) + importe);
    if (naturaleza === NATURALEZAS.SIN_CLASIFICAR) {
      sinClasificar.push({ id: movimiento?.id, concepto: movimiento?.concept || "", importe, motivo });
    }
    if (esGasto) gastoOperativo += importe;
    if (NATURALEZAS_GASTO_FINANCIERO.has(naturaleza)) gastoFinanciero += importe;
    const categoriaObligacion = CATEGORIA_OBLIGACION[texto(movimiento?.expense_category)];
    if (categoriaObligacion && texto(movimiento?.movement_type) === "salida") {
      pagadoPorCategoria[categoriaObligacion] = redondear((pagadoPorCategoria[categoriaObligacion] || 0) + importe);
    }
    if (texto(movimiento?.status) !== "revisado") pendientesRevision += 1;
  }

  // Devengado del mes por categoría: vencimientos que caen en el calendario.
  const devengadoPorCategoria = {};
  for (const obligacion of obligaciones || []) {
    if (texto(obligacion?.estado) === "cancelada") continue;
    const importe = importeValido(obligacion?.importe);
    const vencimientos = vencimientosEnMes(obligacion, mes);
    if (importe === null || !vencimientos) continue;
    const categoria = String(obligacion?.categoria || "OTRO").toUpperCase();
    devengadoPorCategoria[categoria] = redondear((devengadoPorCategoria[categoria] || 0) + importe * vencimientos);
  }

  const hayMovimientos = considerados > 0;
  const diferencias = Object.keys({ ...devengadoPorCategoria, ...pagadoPorCategoria })
    .filter((categoria) => categoria !== "OTRO")
    .map((categoria) => {
      const devengado = devengadoPorCategoria[categoria] ?? null;
      const pagado = hayMovimientos ? pagadoPorCategoria[categoria] ?? 0 : null;
      const pendiente = devengado === null || pagado === null ? null : redondear(Math.max(0, devengado - pagado));
      const relativa = devengado && pagado !== null ? Math.abs(pagado - devengado) / devengado : null;
      let motivo = "";
      if (devengado === null) motivo = "Hay pagos de esta categoría sin obligación que venza en el mes.";
      else if (pagado === null) motivo = "Sin movimientos del mes: no se sabe qué se pagó.";
      else if (relativa > 0.1) {
        motivo = pagado < devengado
          ? "Pagado menor a lo que vence en el mes: pago pendiente o registrado en otra categoría."
          : "Pagado mayor a lo que vence en el mes: revisa duplicados, adelantos o gastos sin obligación.";
      }
      return {
        categoria,
        devengado,
        pagado,
        pendiente,
        diferencia: devengado === null || pagado === null ? null : redondear(pagado - devengado),
        nivel: "categoria",
        motivo,
      };
    });

  const motivosConfianza = [];
  const pagosSatSinTipo = porNaturaleza[NATURALEZAS.IMPUESTOS] || 0;
  if (!hayMovimientos) motivosConfianza.push("No hay movimientos registrados en el mes.");
  if (sinClasificar.length) motivosConfianza.push(`${sinClasificar.length} movimiento(s) sin clasificar.`);
  if (gastosFijos && gastosFijos.completo === false) motivosConfianza.push("Obligaciones fijas incompletas.");
  const conDiferencia = diferencias.filter((fila) => fila.motivo);
  let confianza = "alta";
  if (!hayMovimientos || sinClasificar.length || (gastosFijos && gastosFijos.completo === false)) {
    confianza = "baja";
  } else if (pendientesRevision || conDiferencia.length || pagosSatSinTipo) {
    confianza = "media";
    if (pendientesRevision) motivosConfianza.push(`${pendientesRevision} movimiento(s) pendientes de revisión.`);
    if (conDiferencia.length) motivosConfianza.push(`${conDiferencia.length} categoría(s) con diferencia mayor a 10%.`);
    if (pagosSatSinTipo) motivosConfianza.push("Pagos al SAT sin indicar si son IVA, ISR o de periodos anteriores.");
  }

  return {
    mes,
    movimientosConsiderados: considerados,
    porNaturaleza,
    gastoOperativoReal: hayMovimientos ? redondear(gastoOperativo) : null,
    gastoFinanciero: hayMovimientos ? redondear(gastoFinanciero) : null,
    impuestos: hayMovimientos
      ? {
          sinTipo: pagosSatSinTipo,
          iva: porNaturaleza[NATURALEZAS.IMPUESTO_IVA] || 0,
          isr: porNaturaleza[NATURALEZAS.IMPUESTO_ISR] || 0,
        }
      : null,
    noSonGasto: hayMovimientos
      ? {
          compraInventario: porNaturaleza[NATURALEZAS.COMPRA_INVENTARIO] || 0,
          retiros: porNaturaleza[NATURALEZAS.RETIRO_PROPIETARIA] || 0,
          financiamiento: porNaturaleza[NATURALEZAS.FINANCIAMIENTO] || 0,
          capitalDeuda: porNaturaleza[NATURALEZAS.CAPITAL_DEUDA] || 0,
          traspasos: porNaturaleza[NATURALEZAS.TRASPASO] || 0,
        }
      : null,
    noSonVenta: hayMovimientos
      ? {
          cobrosMarketplace: porNaturaleza[NATURALEZAS.COBRO_MARKETPLACE] || 0,
          ventaYaEnSicar: porNaturaleza[NATURALEZAS.VENTA_SICAR] || 0,
        }
      : null,
    sinClasificar,
    pendientesRevision,
    diferencias,
    confianza,
    motivosConfianza,
    limites: [
      "La comparación es por categoría: no prueba que cada obligación individual esté pagada.",
      "Pagos registrados como 'impuestos' sin tipo no se cuentan como gasto operativo.",
      "Los depósitos de marketplace son cobros de ventas ya registradas, no ventas nuevas.",
      "Flotilla se concilia en su propio negocio.",
    ],
  };
}
