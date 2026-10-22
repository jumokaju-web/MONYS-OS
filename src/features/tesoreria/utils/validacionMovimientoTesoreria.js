export const CATEGORIAS_GASTO = [
  ["compras_inventario", "Compra de inventario"],
  ["renta", "Renta"],
  ["nomina", "Nómina"],
  ["servicios", "Servicios"],
  ["marketing", "Marketing"],
  ["transporte", "Transporte"],
  ["impuestos", "Impuestos"],
  ["mantenimiento", "Mantenimiento"],
  ["papeleria", "Papelería"],
  ["comisiones", "Comisiones"],
  ["anticipo_prestamo", "Anticipo o préstamo"],
  ["retiro_propietaria", "Retiro de propietaria"],
  ["otro", "Otro"],
];

export const CATEGORIAS_GASTO_ANTERIORES = [
  ["compra_mercancia", "Compra de mercancía (registro anterior)"],
  ["limpieza", "Limpieza (registro anterior)"],
  ["alimentos", "Alimentos (registro anterior)"],
  ["otros", "Otros (registro anterior)"],
];

const CATEGORIAS_SIN_IMPACTO_EN_UTILIDAD = new Set([
  "anticipo_prestamo",
  "retiro_propietaria",
  "traspaso_caja",
  "ajuste_cancelacion",
  "registro_prueba",
  "ingreso_caja_sicar",
]);

export function permiteNoAplica(categoria) {
  return CATEGORIAS_SIN_IMPACTO_EN_UTILIDAD.has(
    String(categoria || "").trim().toLowerCase(),
  );
}

export function validarMovimientoParaRevision(movimiento = {}) {
  const tipo = String(movimiento.movement_type ?? movimiento.tipo ?? "")
    .trim()
    .toLowerCase();
  const esSalida = tipo === "salida";
  if (!esSalida) return { valido: true, motivo: "" };

  const categoria = String(
    movimiento.expense_category ?? movimiento.categoria ?? "",
  ).trim().toLowerCase();
  if (!categoria || categoria === "sin_clasificar") {
    return {
      valido: false,
      motivo: "Clasifica la categoría del gasto antes de marcarlo como revisado.",
    };
  }

  const comportamiento = String(
    movimiento.expense_behavior ?? movimiento.comportamiento ?? "",
  ).trim().toLowerCase();
  if (!["fijo", "variable", "no_aplica"].includes(comportamiento)) {
    return {
      valido: false,
      motivo: "Indica si el gasto es fijo, variable o no aplica antes de marcarlo como revisado.",
    };
  }

  if (
    comportamiento === "no_aplica" &&
    !permiteNoAplica(categoria)
  ) {
    return {
      valido: false,
      motivo:
        "Un gasto de operación debe ser fijo o variable. Usa “No aplica” solo para préstamos, retiros o movimientos que no son gasto.",
    };
  }

  return { valido: true, motivo: "" };
}
