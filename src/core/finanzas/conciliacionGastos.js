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
import { FACTOR_MENSUAL } from "./equilibrioReal.js";

export const NATURALEZAS = Object.freeze({
  GASTO_FIJO: "gasto_operativo_fijo",
  GASTO_VARIABLE: "gasto_operativo_variable",
  NOMINA: "nomina",
  IMPUESTOS: "impuestos",
  COMISIONES: "comisiones",
  COMPRA_INVENTARIO: "compra_inventario",
  RETIRO_PROPIETARIA: "retiro_propietaria",
  FINANCIAMIENTO: "financiamiento",
  TRASPASO: "traspaso",
  AJUSTE: "ajuste",
  VENTA_SICAR: "venta_registrada_sicar",
  SIN_CLASIFICAR: "sin_clasificar",
});

// Naturalezas que son gasto de operación (afectan utilidad y equilibrio).
export const NATURALEZAS_GASTO = new Set([
  NATURALEZAS.GASTO_FIJO,
  NATURALEZAS.GASTO_VARIABLE,
  NATURALEZAS.NOMINA,
  NATURALEZAS.IMPUESTOS,
  NATURALEZAS.COMISIONES,
]);

const CATEGORIA_A_NATURALEZA_SALIDA = {
  nomina: NATURALEZAS.NOMINA,
  impuestos: NATURALEZAS.IMPUESTOS,
  comisiones: NATURALEZAS.COMISIONES,
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
 * - Se excluyen movimientos cancelados y de otros meses.
 * - Totales por naturaleza; gasto operativo real = suma de NATURALEZAS_GASTO.
 * - Por categoría con obligación (renta, nómina, servicios, impuestos):
 *   esperado (obligaciones del mes) contra pagado.
 * - Confianza:
 *   alta  = todo clasificado y revisado, obligaciones completas y sin
 *           diferencias > 10% por categoría.
 *   media = clasificado, pero con movimientos pendientes de revisión o
 *           diferencias > 10%.
 *   baja  = movimientos sin clasificar, sin movimientos del mes u
 *           obligaciones incompletas.
 */
export function conciliarGastosDelMes({ movimientos = [], obligaciones = [], mes, gastosFijos = null } = {}) {
  const porNaturaleza = {};
  const sinClasificar = [];
  let pendientesRevision = 0;
  let considerados = 0;
  let gastoOperativo = 0;
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
    if (esGasto) {
      gastoOperativo += importe;
      const categoriaObligacion = CATEGORIA_OBLIGACION[texto(movimiento?.expense_category)];
      if (categoriaObligacion) {
        pagadoPorCategoria[categoriaObligacion] = redondear((pagadoPorCategoria[categoriaObligacion] || 0) + importe);
      }
    }
    if (texto(movimiento?.status) !== "revisado") pendientesRevision += 1;
  }

  // Esperado por categoría desde obligaciones (mismo criterio que equilibrio).
  const esperadoPorCategoria = {};
  for (const obligacion of obligaciones || []) {
    if (texto(obligacion?.estado) === "cancelada") continue;
    const importe = importeValido(obligacion?.importe);
    const frecuencia = String(obligacion?.frecuencia || "UNICA").toUpperCase();
    if (importe === null) continue;
    let mensual = null;
    if (frecuencia === "UNICA") {
      if (String(obligacion?.fecha_vencimiento || "").slice(0, 7) === mes) mensual = importe;
    } else if (FACTOR_MENSUAL[frecuencia]) {
      mensual = importe * FACTOR_MENSUAL[frecuencia];
    }
    if (mensual === null) continue;
    const categoria = String(obligacion?.categoria || "OTRO").toUpperCase();
    esperadoPorCategoria[categoria] = redondear((esperadoPorCategoria[categoria] || 0) + mensual);
  }

  const diferencias = Object.keys({ ...esperadoPorCategoria, ...pagadoPorCategoria })
    .filter((categoria) => categoria !== "OTRO")
    .map((categoria) => {
      const esperado = esperadoPorCategoria[categoria] ?? null;
      const pagado = pagadoPorCategoria[categoria] ?? 0;
      const diferencia = esperado === null ? null : redondear(pagado - esperado);
      const relativa = esperado ? Math.abs(pagado - esperado) / esperado : null;
      return {
        categoria,
        esperado,
        pagado,
        diferencia,
        motivo:
          esperado === null
            ? "Hay pagos de esta categoría sin obligación registrada."
            : relativa > 0.1
              ? pagado < esperado
                ? "Pagado menor a lo esperado: pago pendiente o registrado en otra categoría."
                : "Pagado mayor a lo esperado: revisa duplicados o gastos no registrados como obligación."
              : "",
      };
    });

  const motivosConfianza = [];
  if (considerados === 0) motivosConfianza.push("No hay movimientos registrados en el mes.");
  if (sinClasificar.length) motivosConfianza.push(`${sinClasificar.length} movimiento(s) sin clasificar.`);
  if (gastosFijos && gastosFijos.completo === false) motivosConfianza.push("Obligaciones fijas incompletas.");
  const conDiferencia = diferencias.filter((fila) => fila.motivo);
  let confianza = "alta";
  if (considerados === 0 || sinClasificar.length || (gastosFijos && gastosFijos.completo === false)) {
    confianza = "baja";
  } else if (pendientesRevision || conDiferencia.length) {
    confianza = "media";
    if (pendientesRevision) motivosConfianza.push(`${pendientesRevision} movimiento(s) pendientes de revisión.`);
    if (conDiferencia.length) motivosConfianza.push(`${conDiferencia.length} categoría(s) con diferencia mayor a 10%.`);
  }

  return {
    mes,
    movimientosConsiderados: considerados,
    porNaturaleza,
    gastoOperativoReal: redondear(gastoOperativo),
    noSonGasto: {
      compraInventario: porNaturaleza[NATURALEZAS.COMPRA_INVENTARIO] || 0,
      retiros: porNaturaleza[NATURALEZAS.RETIRO_PROPIETARIA] || 0,
      financiamiento: porNaturaleza[NATURALEZAS.FINANCIAMIENTO] || 0,
      traspasos: porNaturaleza[NATURALEZAS.TRASPASO] || 0,
    },
    sinClasificar,
    pendientesRevision,
    diferencias,
    confianza,
    motivosConfianza,
    limites: [
      "No hay categoría para separar pago de capital e intereses de deuda: esos pagos no se distinguen todavía.",
      "Las liquidaciones de Mercado Libre y otras entradas sin categoría no se cuentan como venta.",
      "Flotilla se concilia en su propio negocio.",
    ],
  };
}
