const MARCADOR = "MONYS_SEGUIMIENTO_CIERRE_V1";

export function claveSeguimientoCierre({ fecha, branchId, cajaId } = {}) {
  return [fecha, branchId, cajaId].map((valor) => String(valor || "").trim()).join("|");
}

export function crearObservacionesSeguimientoCierre(datos = {}) {
  return `[${MARCADOR}]${JSON.stringify({
    fecha: String(datos.fecha || "").trim(),
    branchId: String(datos.branchId || "").trim(),
    cajaId: String(datos.cajaId || "").trim(),
    tipo: datos.tipo === "importes" ? "importes" : "cierre",
    destinatario: String(datos.destinatario || "Encargada de sucursal").trim(),
    registradoPor: String(datos.registradoPor || "Dirección").trim(),
    enviadoEn: datos.enviadoEn || new Date().toISOString(),
  })}`;
}

export function leerSeguimientoCierre(texto) {
  const linea = String(texto || "").split("\n").find((item) => item.startsWith(`[${MARCADOR}]`));
  if (!linea) return null;
  try { return JSON.parse(linea.slice(MARCADOR.length + 2)); }
  catch { return null; }
}

export function indexarSeguimientosCierre(cierres = []) {
  const indice = new Map();
  [...(Array.isArray(cierres) ? cierres : [])]
    .sort((a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0))
    .forEach((registro) => {
      const seguimiento = leerSeguimientoCierre(registro?.observaciones);
      if (!seguimiento) return;
      indice.set(claveSeguimientoCierre(seguimiento), { ...seguimiento, registroId: registro.id });
    });
  return indice;
}

export function mensajeSeguimientoCierre({ fecha, sucursal, caja, estado, destinatario } = {}) {
  const saludo = destinatario ? `Hola ${destinatario}.` : "Hola.";
  const contexto = `${caja || "Caja"} de ${sucursal || "la sucursal"} del ${fecha || "día de hoy"}`;
  if (estado === "incompleto") {
    return `${saludo} Recibimos el cierre de ${contexto}, pero faltan los importes y la evidencia. Por favor completa en MONYS la venta SICAR, cobros por método, efectivo retirado, efectivo final y fotografía del reporte.`;
  }
  return `${saludo} Falta registrar el cierre de ${contexto}. Por favor entra a MONYS, captura los importes reales, adjunta la fotografía de SICAR y finaliza el turno.`;
}
