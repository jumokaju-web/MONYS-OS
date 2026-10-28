const textoClave = (valor) => String(valor ?? "");

const centavos = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
};

function firmaMovimiento(movimiento) {
  return JSON.stringify([
    movimiento.organization_id || "",
    movimiento.business_id || "",
    movimiento.branch_id || "",
    movimiento.account_id || "",
    String(movimiento.tipo || movimiento.movement_type || "").toUpperCase(),
    textoClave(movimiento.concepto ?? movimiento.concept),
    textoClave(movimiento.contraparte ?? movimiento.counterparty),
    movimiento.categoria || movimiento.expense_category || "",
    movimiento.comportamiento || movimiento.expense_behavior || "",
  ]);
}

/**
 * Agrupa para revisión; nunca cambia ni confirma movimientos.
 * Solo reúne salidas pendientes con la misma sucursal, cuenta,
 * concepto, contraparte y clasificación actual.
 */
export function agruparMovimientosPendientes(movimientos = []) {
  const grupos = new Map();

  for (const movimiento of Array.isArray(movimientos) ? movimientos : []) {
    const estado = movimiento.estado || movimiento.status;
    const tipo = String(movimiento.tipo || movimiento.movement_type || "").toUpperCase();
    if (estado !== "Pendiente de revisión" || tipo !== "SALIDA") continue;
    if ((movimiento.distribuciones || []).length > 0) continue;
    if (!textoClave(movimiento.concepto ?? movimiento.concept).trim()) continue;

    const firma = firmaMovimiento(movimiento);
    const grupo = grupos.get(firma) || {
      id: firma,
      branchId: movimiento.branch_id || null,
      accountId: movimiento.account_id || null,
      concept: movimiento.concepto || movimiento.concept || "",
      counterparty: movimiento.contraparte || movimiento.counterparty || "",
      category: movimiento.categoria || movimiento.expense_category || "",
      behavior: movimiento.comportamiento || movimiento.expense_behavior || "",
      ids: [],
      movimientos: [],
      totalCentavos: 0,
    };
    grupo.ids.push(movimiento.id);
    grupo.movimientos.push(movimiento);
    grupo.totalCentavos += centavos(movimiento.monto ?? movimiento.amount);
    grupos.set(firma, grupo);
  }

  return [...grupos.values()]
    .filter((grupo) => grupo.movimientos.length > 1)
    .map((grupo) => ({
      ...grupo,
      total: grupo.totalCentavos / 100,
      movimientos: [...grupo.movimientos].sort((a, b) =>
        String(a.occurred_at || a.fecha || "").localeCompare(String(b.occurred_at || b.fecha || ""))),
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos);
}
