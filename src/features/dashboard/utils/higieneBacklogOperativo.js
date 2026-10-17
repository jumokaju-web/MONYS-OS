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

function fechaValida(valor) {
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
  const fecha = fechaValida(tarea?.fecha);
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
  const fechaHoy = fechaValida(hoy);
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
    const fecha = fechaValida(tarea?.fecha);
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
