export const TITULO_REVISION_TRASPASO = "VERIFICAR TRASPASO:";

const MARCADOR_INSTRUCCIONES = "MONYS_TRASPASO_REVISION_V1:";
const MARCADOR_RESULTADO = "MONYS_TRASPASO_RESULTADO_V1:";

function prioridadNumero(valor) {
  const prioridad = String(valor || "").toUpperCase();
  return prioridad === "ALTA" ? 2 : prioridad === "MEDIA" ? 1 : 0;
}

function obtenerCandidatosSucursal(recomendaciones, branchId) {
  const candidatos = { ORIGEN: [], DESTINO: [] };
  for (const recomendacion of recomendaciones) {
    const cantidad = Number(recomendacion?.cantidadSugerida);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;

    if (String(recomendacion.branchOrigenId) === String(branchId)) {
      candidatos.ORIGEN.push({ recomendacion, lado: "ORIGEN" });
    }
    if (String(recomendacion.branchDestinoId) === String(branchId)) {
      candidatos.DESTINO.push({ recomendacion, lado: "DESTINO" });
    }
  }

  const ordenar = (a, b) =>
    prioridadNumero(b.recomendacion.prioridad) - prioridadNumero(a.recomendacion.prioridad) ||
    (a.recomendacion.coberturaDestino ?? Number.POSITIVE_INFINITY) -
      (b.recomendacion.coberturaDestino ?? Number.POSITIVE_INFINITY) ||
    String(a.recomendacion.producto || "").localeCompare(String(b.recomendacion.producto || ""), "es-MX");

  candidatos.ORIGEN.sort(ordenar);
  candidatos.DESTINO.sort(ordenar);
  return candidatos;
}

export function construirVerificacionesTraspaso(recomendaciones, { maximoPorSucursal = 2 } = {}) {
  const maximo = Math.max(1, Math.min(2, Number(maximoPorSucursal) || 2));
  const lista = Array.isArray(recomendaciones) ? recomendaciones : [];
  const sucursales = new Map();

  for (const item of lista) {
    if (prioridadNumero(item?.prioridad) === 0) continue;
    if (!item?.branchOrigenId || !item?.branchDestinoId) continue;
    for (const branchId of [item.branchOrigenId, item.branchDestinoId]) {
      sucursales.set(String(branchId), branchId);
    }
  }

  const tareas = [];
  for (const branchId of sucursales.values()) {
    const candidatos = obtenerCandidatosSucursal(lista, branchId);
    const seleccionados = [];

    // Primero cubre una posible salida y una posible recepción en esta sucursal.
    for (const lado of ["ORIGEN", "DESTINO"]) {
      if (seleccionados.length >= maximo) break;
      if (candidatos[lado][0]) seleccionados.push(candidatos[lado][0]);
    }

    // Si solo existe una dirección, aprovecha la segunda revisión en otro producto.
    for (const lado of ["ORIGEN", "DESTINO"]) {
      for (const candidato of candidatos[lado]) {
        if (seleccionados.length >= maximo) break;
        if (!seleccionados.some((item) => item.lado === lado && item.recomendacion === candidato.recomendacion)) {
          seleccionados.push(candidato);
        }
      }
    }

    for (const { recomendacion, lado } of seleccionados) {
      const esOrigen = lado === "ORIGEN";
      tareas.push({
        branchId,
        lado,
        recomendacion,
        titulo: `${TITULO_REVISION_TRASPASO} ${recomendacion.producto} · ${recomendacion.sucursalOrigen} → ${recomendacion.sucursalDestino} · ${lado}`,
        descripcion: esOrigen
          ? `MONYS detectó un posible excedente de ${recomendacion.producto}. Confirma físicamente si de verdad hay piezas disponibles para enviar a ${recomendacion.sucursalDestino}.`
          : `MONYS detectó una posible necesidad de ${recomendacion.producto}. Confirma físicamente si de verdad faltan piezas en ${recomendacion.sucursalDestino}.`,
        instrucciones: `${MARCADOR_INSTRUCCIONES}${encodeURIComponent(JSON.stringify({
          version: 1,
          lado,
          productId: recomendacion.productId || null,
          codigo: recomendacion.codigo || null,
          producto: recomendacion.producto || "Producto pendiente de identificar",
          sucursalOrigen: recomendacion.sucursalOrigen,
          sucursalDestino: recomendacion.sucursalDestino,
          branchOrigenId: recomendacion.branchOrigenId,
          branchDestinoId: recomendacion.branchDestinoId,
          existenciaOrigen: recomendacion.existenciaOrigen,
          existenciaDestino: recomendacion.existenciaDestino,
          cantidadSugerida: recomendacion.cantidadSugerida,
          ventasOrigen: recomendacion.ventasOrigen,
          ventasDestino: recomendacion.ventasDestino,
          periodoInicio: recomendacion.periodoInicio,
          periodoFin: recomendacion.periodoFin,
          diasAnalizados: recomendacion.diasAnalizados,
        }))}`,
      });
    }
  }

  return tareas;
}

export function leerRevisionTraspaso(tarea) {
  if (!String(tarea?.titulo || "").startsWith(TITULO_REVISION_TRASPASO)) return null;
  const instrucciones = String(tarea?.instrucciones || "");
  const indice = instrucciones.indexOf(MARCADOR_INSTRUCCIONES);
  if (indice < 0) return null;
  try {
    const datos = JSON.parse(decodeURIComponent(instrucciones.slice(indice + MARCADOR_INSTRUCCIONES.length)));
    if (datos?.version !== 1 || !["ORIGEN", "DESTINO"].includes(datos.lado)) return null;
    return datos;
  } catch {
    return null;
  }
}

export function validarCapturaRevisionTraspaso(datos = {}) {
  const cantidadTexto = String(datos.existenciaFisica ?? "").trim();
  if (!cantidadTexto) return false;
  const cantidad = Number(cantidadTexto);
  if (!Number.isInteger(cantidad) || cantidad < 0) return false;
  const decisiones = datos.lado === "ORIGEN"
    ? ["hay_excedente", "no_hay_excedente", "ajustar"]
    : ["si_hace_falta", "no_hace_falta", "ajustar"];
  return decisiones.includes(datos.decision);
}

export function crearResultadoRevisionTraspaso(datos = {}) {
  if (!validarCapturaRevisionTraspaso(datos)) {
    throw new Error("Registra la existencia física y el resultado de la revisión.");
  }
  const resultado = {
    version: 1,
    lado: datos.lado,
    existenciaFisica: Number(String(datos.existenciaFisica).trim()),
    decision: datos.decision,
    observaciones: String(datos.observaciones || "").trim(),
  };
  return `${MARCADOR_RESULTADO}${JSON.stringify(resultado)}`;
}

