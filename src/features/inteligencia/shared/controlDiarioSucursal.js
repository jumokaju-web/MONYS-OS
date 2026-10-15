function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function diaSemana(fecha) {
  const valor = new Date(`${fecha}T12:00:00`);
  return Number.isNaN(valor.getTime()) ? null : valor.getDay();
}

function tareaPerteneceAEmpleado(tarea, empleado, configuracion) {
  const idsEmpleado = [empleado.id, empleado.usuario_id, empleado.auth_user_id]
    .filter(Boolean)
    .map(String);
  const idsTarea = [tarea.responsable_empleado_id, tarea.empleado_id, tarea.responsable_usuario_id]
    .filter(Boolean)
    .map(String);
  if (idsTarea.some((id) => idsEmpleado.includes(id))) return true;

  const responsable = normalizarTexto(tarea.responsable);
  if (!responsable) return false;
  return [empleado.nombre, configuracion?.nombre_preferido]
    .some((nombre) => normalizarTexto(nombre) === responsable);
}

export function construirControlDiarioSucursal({
  fecha,
  empleados = [],
  configuraciones = [],
  asistencias = [],
  tareas = [],
} = {}) {
  const activos = (Array.isArray(empleados) ? empleados : [])
    .filter((empleado) => empleado?.active !== false);
  const perfiles = new Map((Array.isArray(configuraciones) ? configuraciones : [])
    .map((configuracion) => [String(configuracion.empleado_id), configuracion]));
  const entradas = new Map((Array.isArray(asistencias) ? asistencias : [])
    .filter((asistencia) => asistencia?.empleado_id)
    .map((asistencia) => [String(asistencia.empleado_id), asistencia]));
  const listaTareas = (Array.isArray(tareas) ? tareas : [])
    .filter((tarea) => tarea?.estado !== "cancelada");
  const dia = diaSemana(fecha);

  const personas = activos.map((empleado) => {
    const configuracion = perfiles.get(String(empleado.id));
    const entrada = entradas.get(String(empleado.id));
    const descansa = Boolean(configuracion && dia !== null && Number(configuracion.dia_descanso) === dia);
    const tareasEmpleado = listaTareas.filter((tarea) => tareaPerteneceAEmpleado(tarea, empleado, configuracion));
    const terminadas = tareasEmpleado.filter((tarea) => tarea.estado === "terminada").length;
    const enProceso = tareasEmpleado.filter((tarea) => tarea.estado === "en_proceso").length;
    const pendientes = tareasEmpleado.filter((tarea) => !["terminada", "en_proceso"].includes(tarea.estado)).length;
    const estado = !empleado.auth_user_id
      ? "SIN_ACCESO"
      : !configuracion
        ? "SIN_PERFIL"
        : descansa
          ? "DESCANSA"
          : entrada
            ? "PRESENTE"
            : "SIN_ENTRADA";
    return {
      empleadoId: empleado.id,
      nombre: configuracion?.nombre_preferido || empleado.nombre || "Sin nombre",
      puesto: empleado.puesto || "Puesto pendiente",
      estado,
      entradaAt: entrada?.entrada_at || null,
      tareas: tareasEmpleado.length,
      terminadas,
      enProceso,
      pendientes,
    };
  });

  const presentes = personas.filter((persona) => persona.estado === "PRESENTE").length;
  const sinEntrada = personas.filter((persona) => persona.estado === "SIN_ENTRADA").length;
  const sinPerfil = personas.filter((persona) => persona.estado === "SIN_PERFIL").length;
  const sinAcceso = personas.filter((persona) => persona.estado === "SIN_ACCESO").length;
  const descansan = personas.filter((persona) => persona.estado === "DESCANSA").length;
  const tareasAbiertas = listaTareas.filter((tarea) => !["terminada", "cancelada"].includes(tarea.estado)).length;
  const tareasTerminadas = listaTareas.filter((tarea) => tarea.estado === "terminada").length;
  const urgentes = listaTareas.filter((tarea) => tarea.prioridad === "urgente" && !["terminada", "cancelada"].includes(tarea.estado)).length;
  const tareasSinResponsable = listaTareas.filter((tarea) => !String(tarea.responsable || "").trim() && !tarea.responsable_usuario_id).length;

  let prioridad = {
    nivel: "bien",
    titulo: "Operación al día",
    detalle: "No hay bloqueos operativos detectados con los registros disponibles.",
  };
  if (!activos.length) {
    prioridad = { nivel: "alta", titulo: "Registra al equipo de la sucursal", detalle: "Sin fichas activas MONYS no puede controlar asistencia ni repartir responsabilidades." };
  } else if (sinAcceso) {
    prioridad = { nivel: "alta", titulo: `Vincula ${sinAcceso} acceso${sinAcceso === 1 ? "" : "s"}`, detalle: "Sin usuario vinculado esas personas no pueden registrar entrada ni recibir tareas propias." };
  } else if (sinPerfil) {
    prioridad = { nivel: "alta", titulo: `Configura ${sinPerfil} perfil${sinPerfil === 1 ? "" : "es"} operativo${sinPerfil === 1 ? "" : "s"}`, detalle: "Faltan turno, descanso o áreas; el reparto automático todavía no puede incluir a todo el equipo." };
  } else if (sinEntrada) {
    prioridad = { nivel: "media", titulo: `Confirma ${sinEntrada} entrada${sinEntrada === 1 ? "" : "s"}`, detalle: "MONYS no asignará tareas de hoy a quien no registró su llegada." };
  } else if (urgentes) {
    prioridad = { nivel: "alta", titulo: `Atiende ${urgentes} tarea${urgentes === 1 ? " urgente" : "s urgentes"}`, detalle: "Las tareas urgentes siguen abiertas y requieren seguimiento de Dirección." };
  } else if (presentes > 0 && listaTareas.length === 0) {
    prioridad = { nivel: "media", titulo: "Prepara el reparto del día", detalle: "Hay personal presente, pero todavía no tiene tareas operativas registradas." };
  } else if (tareasSinResponsable) {
    prioridad = { nivel: "media", titulo: `Asigna ${tareasSinResponsable} tarea${tareasSinResponsable === 1 ? "" : "s"}`, detalle: "Hay trabajo registrado sin una persona responsable." };
  } else if (tareasAbiertas > 0) {
    prioridad = { nivel: "seguimiento", titulo: `Da seguimiento a ${tareasAbiertas} tarea${tareasAbiertas === 1 ? "" : "s"}`, detalle: "La operación está en marcha; revisa avances y evidencias antes del cierre." };
  }

  return {
    personas,
    prioridad,
    metricas: {
      activos: activos.length,
      presentes,
      sinEntrada,
      sinPerfil,
      sinAcceso,
      descansan,
      tareasAbiertas,
      tareasTerminadas,
      urgentes,
      tareasSinResponsable,
    },
  };
}
