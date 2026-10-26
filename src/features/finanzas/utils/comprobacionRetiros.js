const ESTADOS_VALIDOS = new Set(["REPORTADO", "COMPROBADO", "DIFERENCIA"]);

function claveRetiro(retiro = {}) {
  return `${retiro.cierreId || ""}|${retiro.cajaId || ""}`;
}

export function integrarComprobacionesRetiros(retiros = [], comprobaciones = []) {
  const ultimas = new Map();
  for (const comprobacion of Array.isArray(comprobaciones) ? comprobaciones : []) {
    const clave = claveRetiro({ cierreId: comprobacion.cierre_id, cajaId: comprobacion.caja_id });
    const anterior = ultimas.get(clave);
    if (!anterior || Number(comprobacion.version || 0) > Number(anterior.version || 0)) {
      ultimas.set(clave, comprobacion);
    }
  }

  const filas = (Array.isArray(retiros) ? retiros : []).map((retiro) => {
    const comprobacion = retiro.cierreId ? ultimas.get(claveRetiro(retiro)) || null : null;
    const estadoComprobacion = ESTADOS_VALIDOS.has(comprobacion?.estado)
      ? comprobacion.estado
      : retiro.estado === "DIFERENCIA" ? "DIFERENCIA" : "PENDIENTE";
    return { ...retiro, comprobacion, estadoComprobacion };
  });

  return {
    filas,
    pendientes: filas.filter((fila) => fila.estadoComprobacion === "PENDIENTE").length,
    reportados: filas.filter((fila) => fila.estadoComprobacion === "REPORTADO").length,
    comprobados: filas.filter((fila) => fila.estadoComprobacion === "COMPROBADO").length,
    diferencias: filas.filter((fila) => fila.estadoComprobacion === "DIFERENCIA").length,
    completo: filas.length > 0 && filas.every((fila) => fila.estadoComprobacion === "COMPROBADO"),
  };
}

export function validarReporteRetiro({ retiro, destinoReal, referencia, evidencia } = {}) {
  if (!retiro?.cierreId) return "Este retiro no tiene un cierre individual que permita comprobarlo.";
  if (!String(destinoReal || "").trim()) return "Indica dónde quedó realmente el efectivo.";
  if (String(destinoReal || "").trim().length > 200) return "El destino real no puede superar 200 caracteres.";
  if (!String(referencia || "").trim()) return "Agrega una referencia de depósito, pago o resguardo.";
  if (String(referencia || "").trim().length > 200) return "La referencia no puede superar 200 caracteres.";
  if (!evidencia) return "Adjunta una foto o archivo que respalde el retiro.";
  if (evidencia.size > 10 * 1024 * 1024) return "El comprobante no puede superar 10 MB.";
  return null;
}
