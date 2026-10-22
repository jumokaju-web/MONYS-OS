import { validarMovimientoParaRevision } from "./validacionMovimientoTesoreria.js";

const aCentavos = (valor) => {
  const normalizado = String(valor ?? "")
    .replace(/[$,\s]/g, "")
    .trim();
  if (!normalizado || !/^-?\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : null;
};

/**
 * Valida el desglose analítico de un movimiento de caja.
 * El movimiento original conserva el importe real pagado; las partidas
 * solo distribuyen ese importe entre destinos para reportes por área.
 */
export function validarDistribucionMovimiento({
  montoTotal,
  partidas = [],
  destinosValidos = [],
} = {}) {
  const totalCentavos = aCentavos(montoTotal);
  if (totalCentavos === null || totalCentavos <= 0) {
    return { valida: false, motivo: "El importe del movimiento debe ser mayor a cero." };
  }
  if (!Array.isArray(partidas) || partidas.length === 0) {
    return { valida: false, motivo: "Agrega al menos un destino para distribuir el pago." };
  }

  const destinos = new Set(
    destinosValidos.map(({ business_id, branch_id }) => `${business_id}:${branch_id}`),
  );
  let sumaCentavos = 0;
  const partidasNormalizadas = [];

  for (const [indice, partida] of partidas.entries()) {
    const businessId = String(partida.business_id ?? "").trim();
    const branchId = String(partida.branch_id ?? "").trim();
    const importeCentavos = aCentavos(partida.amount);
    if (!businessId || !branchId || !destinos.has(`${businessId}:${branchId}`)) {
      return {
        valida: false,
        motivo: `La partida ${indice + 1} debe usar un negocio y sucursal válidos.`,
      };
    }
    if (importeCentavos === null || importeCentavos <= 0) {
      return { valida: false, motivo: `El importe de la partida ${indice + 1} debe ser mayor a cero.` };
    }

    const validacionGasto = validarMovimientoParaRevision({
      movement_type: "SALIDA",
      expense_category: partida.expense_category,
      expense_behavior: partida.expense_behavior,
    });
    if (!validacionGasto.valido) {
      return { valida: false, motivo: `Partida ${indice + 1}: ${validacionGasto.motivo}` };
    }

    sumaCentavos += importeCentavos;
    partidasNormalizadas.push({
      business_id: businessId,
      branch_id: branchId,
      amount: importeCentavos / 100,
      expense_category: String(partida.expense_category).trim(),
      expense_behavior: String(partida.expense_behavior).trim(),
      note: String(partida.note ?? "").trim() || null,
    });
  }

  if (sumaCentavos !== totalCentavos) {
    return {
      valida: false,
      motivo: `Las partidas suman $${(sumaCentavos / 100).toFixed(2)} y deben sumar exactamente $${(totalCentavos / 100).toFixed(2)}.`,
    };
  }

  return {
    valida: true,
    motivo: "",
    partidas: partidasNormalizadas,
    montoTotal: totalCentavos / 100,
  };
}
