const TERMINALES = new Set(["GANADO", "PERDIDO"]);

function fechaValida(valor) {
  const fecha = Date.parse(valor || "");
  return Number.isFinite(fecha) ? fecha : null;
}

function incrementar(map, llave, id, nombre) {
  const actual = map.get(llave) || { id: llave, nombre, oportunidades: 0, ganadas: 0, perdidas: 0, foliosSicar: 0 };
  actual.oportunidades += 1;
  if (id.etapa === "GANADO") actual.ganadas += 1;
  if (id.etapa === "PERDIDO") actual.perdidas += 1;
  if (id.etapa === "GANADO" && String(id.folio_venta_sicar || "").trim()) actual.foliosSicar += 1;
  map.set(llave, actual);
}

function cerrarSegmento(map) {
  return [...map.values()].map((fila) => {
    const cerradas = fila.ganadas + fila.perdidas;
    return { ...fila, cerradas, conversion: cerradas ? Math.round((fila.ganadas / cerradas) * 100) : null };
  }).sort((a, b) => b.ganadas - a.ganadas || b.oportunidades - a.oportunidades || a.nombre.localeCompare(b.nombre, "es"));
}

export function analizarCentroDireccionCRM({ oportunidades = [], interacciones = [], sucursales = [], hoy = new Date().toISOString().slice(0, 10), ahora = Date.now(), sucursalId = "TODAS" } = {}) {
  const ramas = new Map((Array.isArray(sucursales) ? sucursales : []).map((fila) => [String(fila.id), fila.name || "Sucursal"]));
  const todas = Array.isArray(oportunidades) ? oportunidades : [];
  const seleccionadas = sucursalId === "TODAS" ? todas : todas.filter((fila) => String(fila.branch_id || "SIN_SUCURSAL") === String(sucursalId));
  const ids = new Set(seleccionadas.map((fila) => fila.id));
  const historialPorId = new Map();
  for (const interaccion of Array.isArray(interacciones) ? interacciones : []) {
    if (!ids.has(interaccion.oportunidad_id)) continue;
    const filas = historialPorId.get(interaccion.oportunidad_id) || [];
    filas.push(interaccion);
    historialPorId.set(interaccion.oportunidad_id, filas);
  }

  const abiertas = seleccionadas.filter((fila) => !TERMINALES.has(fila.etapa));
  const interaccionesOrdenadas = (fila) => (historialPorId.get(fila.id) || [])
    .filter((item) => ["ENTRANTE", "SALIENTE"].includes(item.direccion))
    .slice().sort((a, b) => String(a.ocurrio_at || "").localeCompare(String(b.ocurrio_at || "")));
  const vencidas = abiertas.filter((fila) => fila.proximo_seguimiento && fila.proximo_seguimiento < hoy);
  const hoySeguimiento = abiertas.filter((fila) => fila.proximo_seguimiento === hoy);
  const sinResponsable = abiertas.filter((fila) => !fila.asignado_a && !fila.empleado_id);
  const cotizaciones = abiertas.filter((fila) => fila.etapa === "COTIZANDO");
  const sinRespuesta = abiertas.filter((fila) => {
    const mensajes = interaccionesOrdenadas(fila);
    const ultimo = mensajes.at(-1);
    const instante = fechaValida(ultimo?.ocurrio_at);
    const clientaRespondioAntes = mensajes.some((item) => item.direccion === "ENTRANTE" && fechaValida(item.ocurrio_at) < instante);
    return ultimo?.direccion === "SALIENTE" && clientaRespondioAntes && instante != null && ahora - instante >= 3 * 24 * 60 * 60 * 1000;
  });

  const tiemposRespuesta = [];
  for (const fila of seleccionadas) {
    const mensajes = interaccionesOrdenadas(fila);
    const primerEntrante = mensajes.find((item) => item.direccion === "ENTRANTE");
    if (!primerEntrante) continue;
    const entradaAt = fechaValida(primerEntrante.ocurrio_at);
    const primeraSalida = mensajes.find((item) => item.direccion === "SALIENTE" && fechaValida(item.ocurrio_at) >= entradaAt);
    const salidaAt = fechaValida(primeraSalida?.ocurrio_at);
    if (entradaAt != null && salidaAt != null && salidaAt >= entradaAt) tiemposRespuesta.push((salidaAt - entradaAt) / 60000);
  }
  tiemposRespuesta.sort((a, b) => a - b);
  const medianaMinutos = tiemposRespuesta.length
    ? Math.round(tiemposRespuesta.length % 2 ? tiemposRespuesta[(tiemposRespuesta.length - 1) / 2] : (tiemposRespuesta[tiemposRespuesta.length / 2 - 1] + tiemposRespuesta[tiemposRespuesta.length / 2]) / 2)
    : null;

  const porResponsable = new Map();
  const porSucursal = new Map();
  const porCanal = new Map();
  const porProducto = new Map();
  const razonesPerdida = [];
  const sinMotivo = [];
  for (const fila of seleccionadas) {
    const responsableId = fila.empleado_id || fila.asignado_a || "SIN_ASIGNAR";
    incrementar(porResponsable, responsableId, fila, fila.responsable_nombre || fila.empleado_nombre || (responsableId === "SIN_ASIGNAR" ? "Sin responsable" : "Responsable por identificar"));
    const sucId = String(fila.branch_id || "SIN_SUCURSAL");
    incrementar(porSucursal, sucId, fila, ramas.get(sucId) || (sucId === "SIN_SUCURSAL" ? "Sucursal sin registrar" : "Sucursal por identificar"));
    incrementar(porCanal, fila.canal || "SIN_CANAL", fila, fila.canal || "Canal sin registrar");
    incrementar(porProducto, String(fila.producto_interes || "SIN_PRODUCTO"), fila, fila.producto_interes || "Producto sin registrar");
    if (fila.etapa === "PERDIDO") {
      const motivo = String(fila.ultimo_resultado || "").match(/(?:motivo de p[eé]rdida|raz[oó]n de p[eé]rdida)\s*:\s*(.+)/i)?.[1]?.trim();
      if (motivo) razonesPerdida.push({ motivo, oportunidadId: fila.id, sucursalId: fila.branch_id || null });
      else sinMotivo.push(fila.id);
    }
  }

  const textosAsociados = seleccionadas.filter((fila) => fila.etapa === "GANADO" && String(fila.folio_venta_sicar || "").trim())
    .flatMap((fila) => (historialPorId.get(fila.id) || []).filter((item) => item.direccion === "SALIENTE" && !/^BORRADOR/i.test(item.mensaje || "")).map((item) => ({ texto: item.mensaje, oportunidadId: fila.id, folio: fila.folio_venta_sicar, sucursalId: fila.branch_id || null })));

  const prioridades = abiertas.map((fila) => {
    const mensajes = interaccionesOrdenadas(fila);
    const ultimo = mensajes.at(-1);
    let prioridad = 10;
    let accion = "Definir la siguiente fecha de contacto y registrarla.";
    let categoria = "PASO_PENDIENTE";
    if (!fila.asignado_a && !fila.empleado_id) { prioridad = 100; categoria = "SIN_RESPONSABLE"; accion = "Asignar una responsable activa de la sucursal."; }
    else if (ultimo?.direccion === "ENTRANTE") { prioridad = 95; categoria = "RESPONDER"; accion = "Responder el último mensaje registrado y guardar el resultado."; }
    else if (fila.proximo_seguimiento && fila.proximo_seguimiento <= hoy) { prioridad = 85; categoria = "SEGUIMIENTO_VENCIDO"; accion = fila.etapa === "COTIZANDO" ? "Confirmar existencia y precio autorizados, y preguntar si desea cerrar el pedido." : "Contactar hoy y registrar si sigue interesada."; }
    else if (ultimo?.direccion === "SALIENTE" && mensajes.some((item) => item.direccion === "ENTRANTE" && fechaValida(item.ocurrio_at) < fechaValida(ultimo.ocurrio_at)) && (ahora - (fechaValida(ultimo.ocurrio_at) || ahora)) >= 3 * 24 * 60 * 60 * 1000) { prioridad = 75; categoria = "SIN_RESPUESTA"; accion = "Enviar un seguimiento breve; el umbral de 3 días es una regla operativa, no evidencia de pérdida."; }
    else if (fila.etapa === "COTIZANDO") { prioridad = 60; categoria = "COTIZACION"; accion = "Revisar los datos de la cotización y programar el siguiente contacto."; }
    else if (!fila.proximo_seguimiento) { prioridad = 50; categoria = "SIN_FECHA"; accion = "Elegir una fecha realista para el siguiente contacto."; }
    return { ...fila, prioridad, categoria, accion };
  }).sort((a, b) => b.prioridad - a.prioridad || String(a.proximo_seguimiento || "9999-12-31").localeCompare(String(b.proximo_seguimiento || "9999-12-31")));

  return {
    total: seleccionadas.length,
    abiertas: abiertas.length,
    sinResponsable: sinResponsable.length,
    vencidas: vencidas.length,
    hoy: hoySeguimiento.length,
    cotizaciones: cotizaciones.length,
    sinRespuesta: sinRespuesta.length,
    ventasSicar: seleccionadas.filter((fila) => fila.etapa === "GANADO" && String(fila.folio_venta_sicar || "").trim()).length,
    primeraRespuesta: { medianaMinutos, muestra: tiemposRespuesta.length, fuente: "Intervalo entre marcas de tiempo de interacciones registradas en MONYS OS." },
    porResponsable: cerrarSegmento(porResponsable),
    porSucursal: cerrarSegmento(porSucursal),
    porCanal: cerrarSegmento(porCanal),
    porProducto: cerrarSegmento(porProducto),
    razonesPerdida,
    perdidasSinMotivo: sinMotivo.length,
    textosAsociados,
    acciones: prioridades,
  };
}
