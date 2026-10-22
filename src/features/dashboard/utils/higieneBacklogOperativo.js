const ESTADOS_ABIERTOS = new Set(["pendiente", "en_proceso", "analizando"]);

export function normalizarTextoBacklog(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fechaValidaBacklog(valor) {
  const texto = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T12:00:00Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto ? null : texto;
}

function tieneResultado(tarea) {
  return normalizarTextoBacklog(tarea?.resultado).length > 0;
}

function responsableExacto(tarea) {
  return tarea?.responsable_usuario_id
    ? `usuario:${tarea.responsable_usuario_id}`
    : `nombre:${normalizarTextoBacklog(tarea?.responsable)}`;
}

export function firmaDuplicadoExacto(tarea) {
  const fecha = fechaValidaBacklog(tarea?.fecha);
  if (!tarea?.organization_id || !tarea?.business_id || !tarea?.branch_id || !fecha) {
    return null;
  }

  return [
    tarea.organization_id,
    tarea.business_id,
    tarea.branch_id,
    normalizarTextoBacklog(tarea.area),
    fecha,
    normalizarTextoBacklog(tarea.titulo),
    normalizarTextoBacklog(tarea.descripcion),
    normalizarTextoBacklog(tarea.instrucciones),
    responsableExacto(tarea),
    normalizarTextoBacklog(tarea.prioridad),
    String(tarea.hora_limite || ""),
    String(Boolean(tarea.requiere_evidencia)),
    normalizarTextoBacklog(tarea.criterio_exito),
    String(Boolean(tarea.requiere_revision)),
    JSON.stringify(tarea.checklist ?? null),
  ].join("|");
}

function ordenarPrincipal(a, b) {
  const fechaA = String(a?.created_at || "");
  const fechaB = String(b?.created_at || "");
  if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function analizarBacklogOperativo(tareas = [], { hoy } = {}) {
  const fechaHoy = fechaValidaBacklog(hoy);
  const abiertas = (Array.isArray(tareas) ? tareas : []).filter((tarea) =>
    ESTADOS_ABIERTOS.has(String(tarea?.estado || "").toLowerCase()),
  );

  const vencidas = [];
  const deHoy = [];
  const futuras = [];
  const fechaPendiente = [];
  const protegidas = [];
  const candidatasPorFirma = new Map();

  abiertas.forEach((tarea) => {
    const fecha = fechaValidaBacklog(tarea?.fecha);
    if (!fecha || !fechaHoy) fechaPendiente.push(tarea);
    else if (fecha < fechaHoy) vencidas.push(tarea);
    else if (fecha === fechaHoy) deHoy.push(tarea);
    else futuras.push(tarea);

    const esPendiente = String(tarea?.estado || "").toLowerCase() === "pendiente";
    const firma = esPendiente && !tieneResultado(tarea) ? firmaDuplicadoExacto(tarea) : null;
    if (!firma) {
      if (!esPendiente || tieneResultado(tarea)) protegidas.push(tarea);
      return;
    }
    const grupo = candidatasPorFirma.get(firma) || [];
    grupo.push(tarea);
    candidatasPorFirma.set(firma, grupo);
  });

  const gruposDuplicados = [...candidatasPorFirma.entries()]
    .filter(([, grupo]) => grupo.length > 1)
    .map(([firma, grupo]) => {
      const ordenadas = [...grupo].sort(ordenarPrincipal);
      const principal = ordenadas[0];
      return {
        firma,
        principal,
        duplicadas: ordenadas.slice(1),
        cantidad: ordenadas.length,
        razon: "Coincidencia exacta de fecha, sucursal, área, responsable, título e instrucciones.",
      };
    })
    .sort((a, b) => {
      const porFecha = String(a.principal?.fecha || "").localeCompare(String(b.principal?.fecha || ""));
      return porFecha || String(a.principal?.titulo || "").localeCompare(String(b.principal?.titulo || ""));
    });

  const copiasExactas = gruposDuplicados.reduce((total, grupo) => total + grupo.duplicadas.length, 0);

  return {
    totalAbiertas: abiertas.length,
    vencidas,
    deHoy,
    futuras,
    fechaPendiente,
    protegidas,
    gruposDuplicados,
    copiasExactas,
    prioridad: vencidas.length > 0
      ? `Revisar ${vencidas.length} tarea${vencidas.length === 1 ? " vencida" : "s vencidas"}.`
      : copiasExactas > 0
        ? `Revisar ${copiasExactas} copia${copiasExactas === 1 ? " exacta" : "s exactas"}.`
        : "El trabajo abierto no presenta atraso comprobado.",
  };
}

function diasEntre(fechaInicial, fechaFinal) {
  const inicio = fechaValidaBacklog(fechaInicial);
  const fin = fechaValidaBacklog(fechaFinal);
  if (!inicio || !fin) return null;
  return Math.floor((new Date(`${fin}T12:00:00Z`) - new Date(`${inicio}T12:00:00Z`)) / 86400000);
}

function puntosPrioridad(valor) {
  const prioridad = normalizarTextoBacklog(valor);
  if (["urgente", "critica", "critico"].includes(prioridad)) return 40;
  if (prioridad === "alta") return 30;
  if (prioridad === "baja") return 5;
  return 15;
}

function textoRegistrado(...valores) {
  return valores
    .map((valor) => String(valor || "").trim())
    .filter(Boolean)
    .join(" ");
}

function detalleDespuesDeDosPuntos(titulo) {
  const partes = String(titulo || "").split(":");
  return partes.length > 1 ? partes.slice(1).join(":").trim() : "";
}

function alcanceEspecificoRegistrado(tarea, tipo) {
  const detalleTitulo = detalleDespuesDeDosPuntos(tarea?.titulo);
  if (normalizarTextoBacklog(detalleTitulo).length >= 5) return detalleTitulo;

  const descripcion = String(tarea?.descripcion || "").trim();
  const normalizada = normalizarTextoBacklog(descripcion);
  if (normalizada.length < 12) return "";
  const marcadoresPorTipo = {
    inventario: ["producto", "codigo", "clave", "sku", "folio"],
    finanzas: ["folio", "factura", "movimiento", "cuenta", "proveedor", "importe"],
    marketing: ["producto", "campana", "canal", "publicacion", "periodo"],
    operacion: ["producto", "folio", "documento", "movimiento", "incidencia", "sucursal"],
  };
  const marcadores = marcadoresPorTipo[tipo] || marcadoresPorTipo.operacion;
  return marcadores.some((marcador) => normalizada.includes(marcador)) ? descripcion : "";
}

function detectarTipoRescate(tarea) {
  const texto = normalizarTextoBacklog(textoRegistrado(
    tarea?.titulo,
    tarea?.descripcion,
    tarea?.area,
  ));
  if (texto.includes("traspas")) return "traspaso";
  if (texto.includes("inventario") || texto.includes("existencia") || texto.includes("conteo")) return "inventario";
  if (texto.includes("factur") || texto.includes("caja") || texto.includes("pago") || texto.includes("deuda")) return "finanzas";
  if (texto.includes("campana") || texto.includes("publicacion") || texto.includes("marketing")) return "marketing";
  return "operacion";
}

function extraerTraspaso(titulo) {
  const original = String(titulo || "").trim();
  const coincidencia = original.match(/traspaso\s+de\s+(.+?):\s*(\d+)\s*(?:pzas?|piezas?)\s+de\s+(.+?)\s+a\s+(.+)$/i);
  if (!coincidencia) return null;
  return {
    producto: coincidencia[1].trim(),
    cantidad: Number(coincidencia[2]),
    origen: coincidencia[3].trim(),
    destino: coincidencia[4].trim(),
  };
}

/**
 * Convierte una tarea antigua en un borrador operativo. Los pasos son una
 * propuesta explícita; los hechos se limitan a campos ya registrados.
 */
export function construirExpedienteRescate(tarea = {}, { sucursal = "Sucursal identificada" } = {}) {
  const tipo = detectarTipoRescate(tarea);
  const traspaso = tipo === "traspaso" ? extraerTraspaso(tarea.titulo) : null;
  const contexto = textoRegistrado(tarea.descripcion);
  const hechos = [
    tarea.titulo ? `Tarea registrada: ${String(tarea.titulo).trim()}.` : null,
    tarea.fecha ? `Fecha original registrada: ${String(tarea.fecha).slice(0, 10)}.` : null,
    tarea.branch_id ? `Sucursal registrada: ${sucursal}.` : null,
    contexto ? `Contexto registrado: ${contexto}` : null,
  ].filter(Boolean);

  let alcanceSugerido = alcanceEspecificoRegistrado(tarea, tipo);
  let pasos;
  let evidencias;
  let criterioExitoSugerido;
  let faltantesPlan = [];
  let advertencia = "PROPUESTA: Dirección debe revisar este procedimiento antes de enviarlo a una empleada.";

  if (traspaso) {
    alcanceSugerido = `${traspaso.producto}: propuesta registrada de ${traspaso.cantidad} piezas, ${traspaso.origen} → ${traspaso.destino}.`;
    pasos = [
      `Contar físicamente ${traspaso.producto} en ${traspaso.origen}; separar anaquel y bodega.`,
      `Contar físicamente ${traspaso.producto} en ${traspaso.destino}; separar anaquel y bodega.`,
      "Comparar ambos conteos contra la existencia de SICAR del mismo día y anotar cualquier diferencia.",
      `Confirmar con Dirección si continúan autorizadas ${traspaso.cantidad} piezas; no mover producto si el conteo no respalda esa cantidad.`,
      "Si Dirección autoriza, registrar la salida en origen, trasladar el producto y registrar la entrada en destino.",
      "Contar la recepción y reportar las existencias finales de ambas sucursales.",
    ];
    evidencias = [
      "Foto del conteo en origen y destino.",
      "Capturas o folios de SICAR antes del movimiento.",
      "Folio de salida y entrada del traspaso autorizado.",
      "Foto de recepción y conteos finales.",
    ];
    criterioExitoSugerido = `Traspaso de ${traspaso.producto} confirmado por Dirección, con cantidad respaldada por conteo físico, salida y entrada registradas en SICAR, y recepción comprobada sin diferencias.`;
    advertencia = `PROPUESTA: ${traspaso.cantidad} piezas es la cantidad registrada en la tarea, no una orden automática. Debe validarse con conteo físico y SICAR antes de mover producto.`;
  } else if (tipo === "inventario") {
    pasos = [
      "Identificar por nombre, código o folio cada producto incluido en el alcance autorizado.",
      "Consultar en SICAR la existencia registrada de esos productos y guardar la referencia del reporte.",
      "Contar físicamente cada producto en anaquel y bodega, sin ajustar SICAR.",
      "Registrar por producto: existencia SICAR, existencia física y diferencia encontrada.",
      "Enviar las diferencias y su evidencia a Dirección; no corregir inventario sin autorización.",
      "Después de la decisión de Dirección, comprobar y documentar el resultado final.",
    ];
    evidencias = [
      "Captura o folio del reporte SICAR revisado.",
      "Foto legible del conteo físico por producto.",
      "Relación producto–existencia SICAR–existencia física–diferencia.",
    ];
    criterioExitoSugerido = "Productos del alcance identificados, conteo físico documentado, diferencia contra SICAR registrada y cualquier ajuste sometido a autorización de Dirección.";
    if (normalizarTextoBacklog(alcanceSugerido).length < 12) {
      alcanceSugerido = "";
      faltantesPlan = ["productos, códigos o folios exactos que deben revisarse"];
    }
  } else if (tipo === "finanzas") {
    pasos = [
      "Identificar los movimientos, documentos o folios incluidos en el alcance autorizado.",
      "Reunir el registro del sistema y el comprobante externo correspondiente al mismo periodo.",
      "Comparar importe, fecha, concepto y responsable sin convertir datos ausentes en cero.",
      "Registrar cada diferencia y separar dato real, dato pendiente e hipótesis.",
      "Entregar la conciliación a Dirección para autorizar la corrección o el pago.",
      "Comprobar que la decisión autorizada quedó registrada y conservar la evidencia.",
    ];
    evidencias = ["Folio o captura del registro revisado.", "Comprobante externo legible.", "Relación de diferencias y decisión de Dirección."];
    criterioExitoSugerido = "Alcance conciliado con documentos del mismo periodo, diferencias identificadas y decisión final registrada con autorización de Dirección.";
    if (normalizarTextoBacklog(alcanceSugerido).length < 12) faltantesPlan = ["movimientos, documentos o folios exactos que deben revisarse"];
  } else if (tipo === "marketing") {
    pasos = [
      "Confirmar el producto, canal, sucursal y periodo incluidos en el alcance autorizado.",
      "Registrar la línea base disponible antes de ejecutar: venta, inventario y gasto; dejar pendiente lo que no exista.",
      "Preparar la pieza o acción y enviarla a Dirección para autorización.",
      "Ejecutar únicamente la versión autorizada y guardar enlace o captura.",
      "Registrar el resultado real del mismo periodo y separarlo de atribuciones no comprobadas.",
      "Entregar aprendizaje y recomendación de continuar, ajustar o detener.",
    ];
    evidencias = ["Captura de la autorización.", "Enlace o captura de la acción publicada.", "Resultado del canal y venta SICAR del periodo comparable."];
    criterioExitoSugerido = "Acción autorizada ejecutada, costo y resultado real documentados para el mismo periodo, con aprendizaje y siguiente decisión.";
    if (normalizarTextoBacklog(alcanceSugerido).length < 12) faltantesPlan = ["producto, canal, sucursal y periodo exactos"];
  } else {
    pasos = [
      "Confirmar el alcance exacto y la fuente donde se detectó el problema.",
      "Reunir la evidencia inicial sin modificar registros ni inventario.",
      "Ejecutar únicamente la acción autorizada en este plan.",
      "Documentar el resultado real y cualquier diferencia encontrada.",
      "Enviar evidencia a Dirección para revisión.",
      "Cerrar solo cuando Dirección confirme el criterio de éxito.",
    ];
    evidencias = ["Referencia de la fuente original.", "Foto, folio o documento de la ejecución.", "Resultado final verificable."];
    criterioExitoSugerido = "Acción autorizada ejecutada dentro del alcance, resultado real documentado y evidencia suficiente para revisión de Dirección.";
    if (normalizarTextoBacklog(alcanceSugerido).length < 12) faltantesPlan = ["objeto, folio, producto o situación exacta que debe atenderse"];
  }

  return {
    tipo,
    hechos,
    alcanceSugerido,
    pasos,
    evidencias,
    criterioExitoSugerido,
    faltantesPlan,
    advertencia,
  };
}

export function construirInstruccionesRescate({
  alcanceExacto,
  pasos = [],
  evidencias = [],
  instruccionesAnteriores,
  fechaAnterior,
  nuevaFecha,
  motivo,
  autorizadoPor,
  autorizadoAt,
} = {}) {
  const secciones = [
    "PLAN AUTORIZADO DE RESCATE",
    `Alcance exacto: ${String(alcanceExacto || "").trim()}`,
    "PASOS",
    ...pasos.map((paso, indice) => `${indice + 1}. ${String(paso).trim()}`),
    "EVIDENCIA OBLIGATORIA",
    ...evidencias.map((evidencia) => `- ${String(evidencia).trim()}`),
  ];
  const anterior = String(instruccionesAnteriores || "").trim();
  if (anterior) secciones.push("CONTEXTO ORIGINAL CONSERVADO", anterior);
  secciones.push(
    "HISTORIAL DE DIRECCIÓN",
    `Fecha anterior: ${fechaAnterior}`,
    `Nueva fecha: ${nuevaFecha}`,
    `Motivo: ${String(motivo || "").trim()}`,
    `Autorizó usuario: ${autorizadoPor}`,
    `Registrado: ${autorizadoAt}`,
  );
  return secciones.join("\n");
}

export function construirColaRescateBacklog(tareas = [], { hoy } = {}) {
  const analisis = analizarBacklogOperativo(tareas, { hoy });
  const copiasExactas = new Set(
    analisis.gruposDuplicados.flatMap((grupo) => grupo.duplicadas.map((tarea) => tarea.id)),
  );

  const vencidas = analisis.vencidas
    .filter((tarea) => !copiasExactas.has(tarea?.id))
    .map((tarea) => {
      const diasVencida = diasEntre(tarea?.fecha, hoy);
      const estado = String(tarea?.estado || "").toLowerCase();
      const resultadoRegistrado = tieneResultado(tarea);
      const alcanceCompleto = Boolean(
        tarea?.organization_id && tarea?.business_id && tarea?.branch_id && tarea?.id,
      );
      const puedeReprogramar = estado === "pendiente" && !resultadoRegistrado && alcanceCompleto;
      const motivosBloqueo = [];
      if (estado !== "pendiente") motivosBloqueo.push("La tarea ya fue iniciada; primero revisa su avance.");
      if (resultadoRegistrado) motivosBloqueo.push("La tarea ya contiene un resultado que debe conservarse.");
      if (!alcanceCompleto) motivosBloqueo.push("Falta organización, negocio o sucursal.");

      const puntaje = puntosPrioridad(tarea?.prioridad)
        + Math.min(Math.max(diasVencida || 0, 0), 40)
        + (tarea?.responsable_usuario_id ? 0 : 20)
        + (tarea?.requiere_evidencia ? 0 : 5);

      return {
        ...tarea,
        diasVencida,
        puntaje,
        puedeReprogramar,
        motivosBloqueo,
        nivel: puntaje >= 65 ? "CRÍTICA" : puntaje >= 45 ? "ALTA" : "NORMAL",
        faltantes: [
          !tarea?.responsable_usuario_id ? "usuario responsable" : null,
          !normalizarTextoBacklog(tarea?.criterio_exito) ? "criterio de éxito" : null,
          tarea?.requiere_evidencia !== true ? "evidencia obligatoria" : null,
        ].filter(Boolean),
      };
    })
    .sort((a, b) => b.puntaje - a.puntaje || String(a.fecha).localeCompare(String(b.fecha)));

  return {
    candidatas: vencidas.filter((tarea) => tarea.puedeReprogramar),
    requierenRevision: vencidas.filter((tarea) => !tarea.puedeReprogramar),
    sinUsuarioVinculado: vencidas.filter((tarea) => !tarea.responsable_usuario_id).length,
    total: vencidas.length,
  };
}

export function validarReprogramacionTarea({
  tarea,
  hoy,
  nuevaFecha,
  responsableEmpleadoId,
  responsableUsuarioId,
  criterioExito,
  motivo,
  confirmacion,
  alcanceExacto,
  pasos,
  evidencias,
} = {}) {
  if (!tarea?.id || String(tarea?.estado || "").toLowerCase() !== "pendiente") {
    return { valida: false, motivo: "Solo puede reprogramarse una tarea que continúa pendiente." };
  }
  if (tieneResultado(tarea)) {
    return { valida: false, motivo: "La tarea contiene un resultado; revisa ese avance antes de cambiarla." };
  }
  const fechaHoy = fechaValidaBacklog(hoy);
  const fechaNueva = fechaValidaBacklog(nuevaFecha);
  const fechaAnterior = fechaValidaBacklog(tarea.fecha);
  if (!fechaHoy || !fechaAnterior || fechaAnterior >= fechaHoy) {
    return { valida: false, motivo: "La tarea ya no aparece como vencida. Actualiza la bandeja." };
  }
  if (!fechaNueva || fechaNueva < fechaHoy) {
    return { valida: false, motivo: "La nueva fecha debe ser hoy o una fecha futura válida." };
  }
  if (!responsableEmpleadoId || !responsableUsuarioId) {
    return { valida: false, motivo: "Selecciona una empleada con acceso activo a MONYS." };
  }
  if (normalizarTextoBacklog(criterioExito).length < 10) {
    return { valida: false, motivo: "Escribe un criterio de éxito claro de al menos 10 caracteres." };
  }
  if (normalizarTextoBacklog(motivo).length < 10) {
    return { valida: false, motivo: "Explica por qué se reprograma en al menos 10 caracteres." };
  }
  if (normalizarTextoBacklog(alcanceExacto).length < 12) {
    return { valida: false, motivo: "Define el producto, folio, documento o situación exacta que se atenderá." };
  }
  if (!Array.isArray(pasos) || pasos.length < 3 || pasos.some((paso) => normalizarTextoBacklog(paso).length < 10)) {
    return { valida: false, motivo: "El plan necesita al menos tres pasos concretos y completos." };
  }
  if (!Array.isArray(evidencias) || evidencias.length === 0 || evidencias.some((item) => normalizarTextoBacklog(item).length < 8)) {
    return { valida: false, motivo: "Define al menos una evidencia verificable para poder cerrar la tarea." };
  }
  if (confirmacion !== "REPROGRAMAR") {
    return { valida: false, motivo: 'Escribe exactamente "REPROGRAMAR" para autorizar.' };
  }
  return { valida: true, fechaAnterior, fechaNueva };
}

export function construirInstruccionesReprogramadas({
  instruccionesAnteriores,
  fechaAnterior,
  nuevaFecha,
  motivo,
  autorizadoPor,
  autorizadoAt,
} = {}) {
  const anteriores = String(instruccionesAnteriores || "").trim();
  const auditoria = [
    "--- HISTORIAL DE DIRECCIÓN · REPROGRAMACIÓN ---",
    `Fecha anterior: ${fechaAnterior}`,
    `Nueva fecha: ${nuevaFecha}`,
    `Motivo: ${String(motivo || "").trim()}`,
    `Autorizó usuario: ${autorizadoPor}`,
    `Registrado: ${autorizadoAt}`,
  ].join("\n");
  return [anteriores, auditoria].filter(Boolean).join("\n\n");
}

export function validarCierreTareaAtrasada({
  tarea,
  hoy,
  evidencias = [],
  confirmacion,
} = {}) {
  if (!tarea?.id || String(tarea?.estado || "").toLowerCase() !== "en_proceso") {
    return { valida: false, motivo: "Solo se puede cerrar desde esta revisión una tarea iniciada que sigue abierta." };
  }

  const fechaHoy = fechaValidaBacklog(hoy);
  const fechaTarea = fechaValidaBacklog(tarea.fecha);
  if (!fechaHoy || !fechaTarea || fechaTarea >= fechaHoy) {
    return { valida: false, motivo: "La tarea ya no está vencida. Actualiza la bandeja antes de decidir." };
  }

  const evidenciaFinal = (Array.isArray(evidencias) ? evidencias : []).filter((evidencia) =>
    evidencia?.tipo === "final" && String(evidencia?.archivo_path || "").trim(),
  );
  if (evidenciaFinal.length === 0) {
    return { valida: false, motivo: "Falta una foto final guardada. La tarea permanece abierta hasta recibir evidencia." };
  }

  if (confirmacion !== "CERRAR TAREA") {
    return { valida: false, motivo: 'Escribe exactamente "CERRAR TAREA" después de revisar la foto final.' };
  }

  return { valida: true, fechaOriginal: fechaTarea, evidenciasFinales: evidenciaFinal };
}

export function validarCancelacionDuplicados({
  tareas = [],
  principalId,
  duplicadaIds = [],
  hoy,
} = {}) {
  const ids = new Set(duplicadaIds);
  if (!principalId || ids.size === 0 || ids.has(principalId)) {
    return { valida: false, motivo: "La selección no identifica una tarea principal y sus copias." };
  }

  const analisis = analizarBacklogOperativo(tareas, { hoy });
  const grupo = analisis.gruposDuplicados.find((item) =>
    item.principal?.id === principalId &&
    item.duplicadas.length === ids.size &&
    item.duplicadas.every((tarea) => ids.has(tarea.id)),
  );

  return grupo
    ? { valida: true, grupo }
    : { valida: false, motivo: "Las tareas cambiaron o ya no son copias exactas. Actualiza antes de decidir." };
}
