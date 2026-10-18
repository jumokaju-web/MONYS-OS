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
