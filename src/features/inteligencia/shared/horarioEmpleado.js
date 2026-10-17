function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))) return false;
  const valor = new Date(`${fecha}T12:00:00`);
  return !Number.isNaN(valor.getTime()) && valor.toISOString().slice(0, 10) === fecha;
}

function diaSemana(fecha) {
  return new Date(`${fecha}T12:00:00`).getDay();
}

function mismoEmpleado(registro, empleado) {
  const referencias = new Set([
    empleado?.id,
    empleado?.usuario_id,
    empleado?.auth_user_id,
  ].filter(Boolean).map(String));
  return [registro?.empleado_id, registro?.usuario_id]
    .filter(Boolean)
    .some((valor) => referencias.has(String(valor)));
}

function turnoDesdeHoras(inicio, fin, respaldo = null) {
  if (!inicio || !fin) return respaldo;
  const minutos = (hora) => {
    const [h, m] = String(hora).slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  };
  const desde = minutos(inicio);
  const hasta = minutos(fin);
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return respaldo;
  if (desde <= 11 * 60 && hasta >= 18 * 60) return "AMBOS";
  return desde >= 14 * 60 ? "SEGUNDO" : "PRIMERO";
}

function buscarProgramacion(lista, empleadoId, predicado) {
  return (Array.isArray(lista) ? lista : []).find((item) =>
    String(item?.empleado_id || "") === String(empleadoId || "") && predicado(item),
  ) || null;
}

export function resolverHorarioEmpleado({
  fecha,
  empleado,
  perfil = null,
  horarios = [],
  excepciones = [],
  asistenciaRegistrada = null,
} = {}) {
  if (!fechaValida(fecha)) throw new Error("Selecciona una fecha válida para revisar el horario.");

  const dia = diaSemana(fecha);
  const entrada = Array.isArray(asistenciaRegistrada)
    ? asistenciaRegistrada.find((item) => mismoEmpleado(item, empleado)) || null
    : null;
  const excepcion = buscarProgramacion(
    excepciones,
    empleado?.id,
    (item) => item?.fecha === fecha,
  );
  const semanal = buscarProgramacion(
    horarios,
    empleado?.id,
    (item) => Number(item?.dia_semana) === dia,
  );
  const programacion = excepcion || semanal;
  const estadoProgramado = String(programacion?.estado || "").toUpperCase();

  if (entrada) {
    return {
      disponible: true,
      estado: "PRESENTE",
      fuente: "ASISTENCIA_REAL",
      entradaAt: entrada.entrada_at || null,
      branchId: entrada.branch_id || programacion?.branch_id || perfil?.branch_id || empleado?.branch_id || null,
      horaInicio: programacion?.hora_inicio || null,
      horaFin: programacion?.hora_fin || null,
      turno: turnoDesdeHoras(programacion?.hora_inicio, programacion?.hora_fin, perfil?.turno_asignado || null),
      flexible: estadoProgramado === "FLEXIBLE",
    };
  }

  if (programacion) {
    if (estadoProgramado === "DESCANSA") {
      return {
        disponible: false,
        estado: "DESCANSA",
        fuente: excepcion ? "EXCEPCION" : "HORARIO_SEMANAL",
        branchId: programacion.branch_id || perfil?.branch_id || empleado?.branch_id || null,
        horaInicio: null,
        horaFin: null,
        turno: null,
        flexible: false,
      };
    }
    if (estadoProgramado === "FLEXIBLE") {
      return {
        disponible: false,
        estado: "HORARIO_FLEXIBLE",
        fuente: excepcion ? "EXCEPCION" : "HORARIO_SEMANAL",
        branchId: programacion.branch_id || perfil?.branch_id || empleado?.branch_id || null,
        horaInicio: programacion.hora_inicio || null,
        horaFin: programacion.hora_fin || null,
        turno: turnoDesdeHoras(programacion.hora_inicio, programacion.hora_fin, perfil?.turno_asignado || null),
        flexible: true,
      };
    }

    const requiereEntrada = Array.isArray(asistenciaRegistrada);
    return {
      disponible: !requiereEntrada,
      estado: requiereEntrada ? "SIN_ENTRADA" : "PROGRAMADA",
      fuente: excepcion ? "EXCEPCION" : "HORARIO_SEMANAL",
      branchId: programacion.branch_id || perfil?.branch_id || empleado?.branch_id || null,
      horaInicio: programacion.hora_inicio || null,
      horaFin: programacion.hora_fin || null,
      turno: turnoDesdeHoras(programacion.hora_inicio, programacion.hora_fin, perfil?.turno_asignado || null),
      flexible: false,
    };
  }

  if (!perfil) {
    return {
      disponible: false,
      estado: "PERFIL_PENDIENTE",
      fuente: "PENDIENTE",
      branchId: empleado?.branch_id || null,
      horaInicio: null,
      horaFin: null,
      turno: null,
      flexible: false,
    };
  }

  if (Number(perfil.dia_descanso) === dia) {
    return {
      disponible: false,
      estado: "DESCANSA",
      fuente: "PERFIL_BASE",
      branchId: perfil.branch_id || empleado?.branch_id || null,
      horaInicio: null,
      horaFin: null,
      turno: null,
      flexible: false,
    };
  }

  const requiereEntrada = Array.isArray(asistenciaRegistrada);
  return {
    disponible: !requiereEntrada,
    estado: requiereEntrada ? "SIN_ENTRADA" : "PROGRAMADA",
    fuente: "PERFIL_BASE",
    branchId: perfil.branch_id || empleado?.branch_id || null,
    horaInicio: null,
    horaFin: null,
    turno: perfil.turno_asignado || null,
    flexible: false,
  };
}

export function describirHorario(programacion = {}) {
  const estado = String(programacion.estado || "").toUpperCase();
  if (estado === "DESCANSA") return "Descansa";
  if (estado === "FLEXIBLE") return "Horario flexible · confirmar presencia";
  if (programacion.hora_inicio && programacion.hora_fin) {
    return `${String(programacion.hora_inicio).slice(0, 5)} a ${String(programacion.hora_fin).slice(0, 5)}`;
  }
  return "Horario pendiente";
}
