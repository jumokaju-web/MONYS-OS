export function generarResumenUtilidadVentas(datos = []) {
  const filas = Array.isArray(datos) ? datos : [];
  const sumar = (campo) =>
    filas.reduce((total, fila) => total + Number(fila?.[campo] || 0), 0);

  const folios = new Map();
  for (const fila of filas) {
    const folio = String(fila?.folio ?? "").trim().toLocaleUpperCase("es-MX");
    if (!folio) continue;
    const fecha = String(fila?.fecha ?? "").trim().slice(0, 10);
    const claveTicket = `${fecha}|${folio}`;
    folios.set(claveTicket, (folios.get(claveTicket) || 0) + 1);
  }

  const fechasInicio = filas.map((fila) => fila?.periodoInicio).filter(Boolean);
  const fechasFin = filas.map((fila) => fila?.periodoFin).filter(Boolean);
  const fechaInicio = fechasInicio[0] || "";
  const fechaFin = fechasFin[0] || "";
  const ventaTotal = sumar("ventaTotal");
  const costoTotal = sumar("costoTotal");
  const utilidadTotal = sumar("utilidad");
  const foliosDuplicados = [...folios.values()].filter((veces) => veces > 1).length;

  return {
    tipoResumen: "utilidad_ventas",
    totalRegistros: filas.length,
    foliosUnicos: folios.size,
    foliosDuplicados,
    ventaTotal,
    costoTotal,
    utilidadTotal,
    margenUtilidad: ventaTotal !== 0 ? (utilidadTotal / ventaTotal) * 100 : 0,
    fechaInicio,
    fechaFin,
  };
}
