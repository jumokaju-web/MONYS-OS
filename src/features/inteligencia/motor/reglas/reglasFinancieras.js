function obtenerAntiguedadDias(fecha) {
  if (!fecha) {
    return null;
  }

  const fechaValida = new Date(
    `${String(fecha).slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(fechaValida.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - fechaValida.getTime()) /
        86400000
    )
  );
}

function generarReglasFinancieras({
  metricas,
  movimientos = [],
  crearDecision,
}) {
  const decisiones = [];

  const antiguedadVentasDias =
    obtenerAntiguedadDias(
      metricas?.fechaFinal
    );

  const diasAnalizados =
    Number(metricas?.diasAnalizados) || 0;

  const baseFinancieraLista =
    antiguedadVentasDias !== null &&
    antiguedadVentasDias <= 7 &&
    diasAnalizados >= 14;

  if (!baseFinancieraLista) {
    decisiones.push(
      crearDecision({
        id: "actualizar-base-financiera",
        tipo: "alerta",
        nivel: "critico",
        titulo: "Actualizar la base financiera",
        mensaje:
          `Las ventas tienen ${
            antiguedadVentasDias === null
              ? "fecha sin confirmar"
              : `${antiguedadVentasDias} días de antigüedad`
          } y la base contiene ${diasAnalizados} días analizados. MONYS bloqueó compras, gasto y proyecciones nuevas.`,
        recomendacion:
          "Subir los reportes SICAR recientes de Centro y General Anaya y confirmar los movimientos bancarios.",
        origen: "Director Financiero IA",
      })
    );
  }

  if (movimientos.length === 0) {
    decisiones.push(
      crearDecision({
        id: "sin-movimientos",
        tipo: "riesgo",
        nivel: "medio",
        titulo: "Tesorería sin movimientos",
        mensaje:
          "No existen movimientos registrados para complementar el análisis financiero.",
        recomendacion:
          "Registrar entradas, salidas y pagos pendientes para mejorar la calidad de las decisiones.",
        origen: "Director Financiero IA",
      })
    );
  }

  return decisiones;
}

export {
  generarReglasFinancieras,
};
