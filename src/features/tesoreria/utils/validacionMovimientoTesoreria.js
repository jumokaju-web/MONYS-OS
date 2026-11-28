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
  ["comisiones_marketplace", "Comisiones y envíos de Mercado Libre"],
  ["cuotas_imss_infonavit", "Cuotas IMSS e Infonavit"],
  ["intereses_deuda", "Intereses de deuda"],
  ["pago_capital_deuda", "Abono a capital de deuda (no es gasto)"],
  ["impuesto_iva", "IVA pagado al SAT (no es gasto)"],
  ["impuesto_isr", "ISR pagado al SAT (no es gasto operativo)"],
  ["retencion_marketplace", "Retenciones de Mercado Libre (no es gasto)"],
  ["devolucion_marketplace", "Devolución a cliente de Mercado Libre (reduce venta)"],
  ["anticipo_prestamo", "Anticipo o préstamo"],
  ["retiro_propietaria", "Retiro de propietaria"],
  ["otro", "Otro"],
];

// Clasificación de entradas: ninguna cuenta como venta nueva.
export const CATEGORIAS_INGRESO = [
  ["ingreso_caja_sicar", "Venta registrada en SICAR"],
  ["liquidacion_marketplace", "Depósito de Mercado Libre (cobro de ventas ya registradas)"],
  ["traspaso_caja", "Traspaso entre cajas o cuentas"],
  ["anticipo_prestamo", "Préstamo o aportación"],
  ["ajuste_cancelacion", "Ajuste o cancelación"],
];

export const CATEGORIAS_GASTO_ANTERIORES = [
  ["compra_mercancia", "Compra de mercancía (registro anterior)"],
  ["limpieza", "Limpieza (registro anterior)"],
  ["alimentos", "Alimentos (registro anterior)"],
  ["otros", "Otros (registro anterior)"],
];

// Debe coincidir con public.categoria_tesoreria_sin_impacto (migración
// 20261128010000); una prueba lo verifica.
export const CATEGORIAS_SIN_IMPACTO_EN_UTILIDAD = new Set([
  "anticipo_prestamo",
  "retiro_propietaria",
  "traspaso_caja",
  "ajuste_cancelacion",
  "registro_prueba",
  "ingreso_caja_sicar",
  "pago_capital_deuda",
  "impuesto_iva",
  "impuesto_isr",
  "liquidacion_marketplace",
  "retencion_marketplace",
  "devolucion_marketplace",
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
