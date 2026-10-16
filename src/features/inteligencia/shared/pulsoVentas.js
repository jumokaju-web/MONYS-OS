const MARCADOR = "[MONYS_PULSO_VENTAS_V1]";

export function validarValoresPulsoVentas(valores = {}) {
  const conteosValidos = [valores.personas, valores.ventas]
    .every((valor) => String(valor ?? "").trim() !== "" && Number.isInteger(Number(valor)) && Number(valor) >= 0);
  const importe = String(valores.importe ?? "").trim();
  return conteosValidos && importe !== "" && Number.isFinite(Number(importe)) && Number(importe) >= 0;
}

export function crearResultadoPulsoVentas(valores = {}) {
  const reporte = {
    version: 1,
    fuente: "reporte_operativo_empleada",
    personasAtendidas: Number(valores.personas),
    ticketsOPedidos: Number(valores.ventas),
    importeReportado: Number(valores.importe),
    observaciones: String(valores.observaciones || "").trim() || null,
  };

  return [
    `Personas atendidas: ${reporte.personasAtendidas}`,
    `Tickets o pedidos concretados: ${reporte.ticketsOPedidos}`,
    `Importe reportado: $${reporte.importeReportado.toFixed(2)} MXN`,
    `Observaciones: ${reporte.observaciones || "Sin observaciones"}`,
    `${MARCADOR}${JSON.stringify(reporte)}`,
  ].join("\n");
}

export function leerResultadoPulsoVentas(resultado) {
  const texto = String(resultado || "");
  const linea = texto.split("\n").find((item) => item.startsWith(MARCADOR));

  if (linea) {
    try {
      const reporte = JSON.parse(linea.slice(MARCADOR.length));
      if (
        reporte?.version === 1 &&
        [reporte.personasAtendidas, reporte.ticketsOPedidos, reporte.importeReportado]
          .every((valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0)
      ) return reporte;
    } catch {
      return null;
    }
    return null;
  }

  // Lectura de reportes anteriores al formato estructurado.
  const personas = texto.match(/Personas atendidas o contactadas:\s*(\d+)/i);
  const tickets = texto.match(/Ventas o pedidos logrados:\s*(\d+)/i);
  const importe = texto.match(/Importe vendido o atribuido:\s*\$([\d,.]+)/i);
  if (!personas || !tickets || !importe) return null;

  const convertir = (valor) => Number(valor.replace(/,/g, ""));
  const valores = [personas[1], tickets[1], importe[1]].map(convertir);
  if (!valores.every((valor) => Number.isFinite(valor) && valor >= 0)) return null;

  return {
    version: 0,
    fuente: "reporte_operativo_empleada",
    personasAtendidas: valores[0],
    ticketsOPedidos: valores[1],
    importeReportado: valores[2],
    observaciones: texto.match(/Productos solicitados, faltantes u observaciones:\s*(.*)/i)?.[1] || null,
  };
}

export function resumirEstadoPulsos({ empleados = [], tareas = [] } = {}) {
  const pulsos = tareas.filter((tarea) =>
    String(tarea?.titulo || "").toUpperCase().startsWith("PULSO DE VENTAS:")
  );
  const filas = empleados.map((empleado) => {
    const tarea = pulsos.find((item) => empleado.auth_user_id
      ? item.responsable_usuario_id === empleado.auth_user_id
      : String(item.responsable || "").trim().toLocaleLowerCase("es-MX") ===
        String(empleado.nombre || "").trim().toLocaleLowerCase("es-MX"));
    const reporte = tarea?.estado === "terminada"
      ? leerResultadoPulsoVentas(tarea.resultado)
      : null;
    return { empleado, tarea: tarea || null, reporte };
  });

  const reportes = filas.map((fila) => fila.reporte).filter(Boolean);
  return {
    filas,
    reportesRecibidos: reportes.length,
    ventasReportadas: reportes.length
      ? reportes.reduce((total, reporte) => total + reporte.importeReportado, 0)
      : null,
    personasAtendidas: reportes.length
      ? reportes.reduce((total, reporte) => total + reporte.personasAtendidas, 0)
      : null,
    ticketsOPedidos: reportes.length
      ? reportes.reduce((total, reporte) => total + reporte.ticketsOPedidos, 0)
      : null,
  };
}
