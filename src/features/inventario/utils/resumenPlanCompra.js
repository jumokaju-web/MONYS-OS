const numero = (valor) => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
};
const numeroONulo = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
};

export function construirResumenPlanCompra({ compraMaestra = {}, decisionFinanciera = null } = {}) {
  const traspasos = Array.isArray(compraMaestra?.planTraspasos) ? compraMaestra.planTraspasos : [];
  const inversionPropuesta = Math.max(0, numero(decisionFinanciera?.inversionPropuesta ?? compraMaestra?.inversionTotal));
  const capacidadLeida = numeroONulo(decisionFinanciera?.capacidadAutorizable);
  const capacidadAutorizable = capacidadLeida === null ? null : Math.max(0, capacidadLeida);
  const compraAutorizable = decisionFinanciera?.compraAutorizable === true;
  const faltanteLeido = numeroONulo(decisionFinanciera?.faltanteParaAutorizar);
  const faltanteParaAutorizar = capacidadAutorizable === null
    ? null
    : Math.max(0, faltanteLeido ?? (inversionPropuesta - capacidadAutorizable));
  const estado = String(decisionFinanciera?.estado || "").trim() || (
    capacidadAutorizable === null ? "PRESUPUESTO_PENDIENTE" : compraAutorizable ? "AUTORIZABLE" : "NO_AUTORIZABLE"
  );
  const motivo = String(decisionFinanciera?.motivo || "").trim() || (
    capacidadAutorizable === null
      ? "El presupuesto de compra está pendiente de confirmar en Finanzas."
      : compraAutorizable
        ? "La inversión propuesta está dentro de la capacidad financiera disponible."
        : "La inversión propuesta supera la capacidad financiera disponible."
  );

  return {
    totalProductosRevisionInventario: numero(compraMaestra?.totalProductosRevisionInventario),
    totalTraspasos: traspasos.length,
    totalPiezasTraspaso: traspasos.reduce((total, item) => total + Math.max(0, numero(item?.cantidadSugerida)), 0),
    fuentes: Array.isArray(compraMaestra?.fuentes) ? compraMaestra.fuentes : [],
    calidadDatos: compraMaestra?.calidadDatos || {},
    criteriosPriorizacion: ["cobertura", "velocidad", "margen", "costo", "presupuesto_confirmado"],
    fechaGeneracion: new Date().toISOString(),
    version: "compra_maestra_v2",
    decisionFinanciera: {
      compraAutorizable,
      estado,
      inversionPropuesta,
      capacidadAutorizable,
      faltanteParaAutorizar,
      productosCriticos: Math.max(0, numero(decisionFinanciera?.productosCriticos)),
      productosSinCosto: Math.max(0, numero(decisionFinanciera?.productosSinCosto)),
      productosSinMargen: Math.max(0, numero(decisionFinanciera?.productosSinMargen)),
      motivo,
    },
  };
}
