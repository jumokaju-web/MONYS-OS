export function evaluarComparabilidadPeriodos(periodoVentas, periodoUtilidad, hayDatosDeAmbosReportes) {
  if (!hayDatosDeAmbosReportes) {
    return { comparable: true, mensaje: "" };
  }

  const comparable = Boolean(
    periodoVentas?.fechaInicial &&
    periodoVentas?.fechaFinal &&
    periodoUtilidad?.fechaInicial &&
    periodoUtilidad?.fechaFinal &&
    periodoVentas.fechaInicial.slice(0, 10) === periodoUtilidad.fechaInicial.slice(0, 10) &&
    periodoVentas.fechaFinal.slice(0, 10) === periodoUtilidad.fechaFinal.slice(0, 10)
  );

  if (comparable) {
    return { comparable: true, mensaje: "" };
  }

  const periodo = (valor) =>
    valor?.fechaInicial && valor?.fechaFinal
      ? `${valor.fechaInicial.slice(0, 10)} a ${valor.fechaFinal.slice(0, 10)}`
      : "sin fechas verificables";

  return {
    comparable: false,
    mensaje:
      `Comparación de productos pausada: “Ventas por artículo” cubre ${periodo(periodoVentas)} y “Utilidad de ventas” cubre ${periodo(periodoUtilidad)}. Las cifras financieras siguen mostrando el corte SICAR más reciente. Importa ambos reportes del mismo periodo para comparar piezas y producto líder.`,
  };
}
