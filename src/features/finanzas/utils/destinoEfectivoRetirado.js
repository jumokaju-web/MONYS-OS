function centavos(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : null;
}

const ETIQUETAS = {
  RESGUARDO: "Bajo resguardo",
  DEPOSITO_BANCARIO: "Depósito bancario reportado",
  PAGO_DIRECTO: "Pago directo reportado",
  OTRO: "Otro destino reportado",
};

export function resumirDestinoEfectivoRetirado({ cierre = {}, cortesOficiales = {} } = {}) {
  const manuales = Array.isArray(cierre?.retiros) ? cierre.retiros : [];
  const usarOficial = cortesOficiales?.completo === true;
  let base = usarOficial
    ? (cortesOficiales.detalle || []).map((item) => ({
      branchId: item.branchId,
      cajaId: item.cajaId,
      monto: item.efectivoRetirado,
      manual: manuales.find((retiro) => retiro.branchId === item.branchId && retiro.cajaId === item.cajaId) || null,
    }))
    : manuales.map((manual) => ({ branchId: manual.branchId, cajaId: manual.cajaId, monto: manual.monto, manual }));

  const totalSinDetalle = usarOficial
    ? centavos(cortesOficiales?.efectivoRetirado)
    : centavos(cierre?.efectivoEntregado);
  if (base.length === 0 && totalSinDetalle !== null && totalSinDetalle > 0) {
    base = [{ branchId: "SIN_DESGLOSE", cajaId: "TOTAL", monto: totalSinDetalle / 100, manual: null }];
  }

  const filas = base.filter((item) => centavos(item.monto) !== null && centavos(item.monto) > 0).map((item) => {
    const coincideMonto = item.manual && centavos(item.manual.monto) === centavos(item.monto);
    const identificado = coincideMonto && item.manual.estado === "IDENTIFICADO";
    const estado = !item.manual ? "PENDIENTE" : !coincideMonto ? "DIFERENCIA" : identificado ? "IDENTIFICADO" : "PENDIENTE";
    return {
      ...item,
      estado,
      destino: identificado ? item.manual.destino : null,
      etiquetaDestino: identificado ? ETIQUETAS[item.manual.destino] || "Destino reportado" : null,
      responsable: identificado ? item.manual.responsable : null,
      detalle: identificado ? item.manual.detalle : null,
    };
  });
  const porDestino = filas.filter((fila) => fila.estado === "IDENTIFICADO").reduce((resumen, fila) => {
    resumen[fila.destino] = (resumen[fila.destino] || 0) + Number(fila.monto);
    return resumen;
  }, {});

  return {
    fuente: usarOficial ? "SICAR_OFICIAL" : "CIERRE_EQUIPO",
    totalRetirado: filas.length ? filas.reduce((total, fila) => total + Number(fila.monto), 0) : 0,
    identificados: filas.filter((fila) => fila.estado === "IDENTIFICADO").length,
    pendientes: filas.filter((fila) => fila.estado === "PENDIENTE").length,
    diferencias: filas.filter((fila) => fila.estado === "DIFERENCIA").length,
    completo: filas.every((fila) => fila.estado === "IDENTIFICADO"),
    porDestino,
    filas,
  };
}
