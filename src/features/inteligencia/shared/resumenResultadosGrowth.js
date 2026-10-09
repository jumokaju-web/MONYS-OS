function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function campoConfirmado(resultado, campo) {
  const historial = Array.isArray(resultado?.historial)
    ? resultado.historial
    : [];

  return (
    resultado?.camposConfirmados?.[campo] === true ||
    historial.some(
      (registro) =>
        registro?.camposConfirmados?.[campo] === true ||
        Number(registro?.[campo]) > 0
    )
  );
}

export function resumirResultadosCampanas(campanas = []) {
  return (Array.isArray(campanas) ? campanas : []).reduce(
    (resumen, campana) => {
      const resultado = campana?.resultado || {};
      const estado = String(campana?.estado || "").toUpperCase();

      if (["ACTIVA", "PREPARANDO"].includes(estado)) {
        resumen.activas += 1;
      }

      const venta = numeroRegistrado(resultado.ventaAcumulada);
      const inversion = numeroRegistrado(resultado.gastoAcumulado);
      const utilidad = numeroRegistrado(resultado.utilidadEstimadaCampana);
      const ventaConfirmada = campoConfirmado(resultado, "venta");
      const gastoConfirmado = campoConfirmado(resultado, "gasto");

      if (venta !== null && ventaConfirmada) {
        resumen.ventas += venta;
        resumen.campanasConVentas += 1;
      }

      if (inversion !== null && gastoConfirmado) {
        resumen.inversion += inversion;
        resumen.campanasConInversion += 1;
      }

      if (utilidad !== null && ventaConfirmada && gastoConfirmado) {
        resumen.utilidad += utilidad;
        resumen.campanasConUtilidad += 1;
      }

      const decision = String(
        resultado.decisionActual || campana?.decision_ia || ""
      ).toUpperCase();

      if (
        ["ACTIVA", "PREPARANDO"].includes(estado) &&
        [
          "PAUSAR",
          "REPROGRAMAR_PUBLICACION",
          "SOLICITAR_AUTORIZACION_PARA_ESCALAR",
        ].includes(decision) &&
        !resumen.decision
      ) {
        resumen.decision = {
          accion: decision,
          producto: campana?.producto || campana?.nombre || "campaña activa",
        };
      }

      return resumen;
    },
    {
      activas: 0,
      ventas: 0,
      campanasConVentas: 0,
      inversion: 0,
      campanasConInversion: 0,
      utilidad: 0,
      campanasConUtilidad: 0,
      decision: null,
    }
  );
}
