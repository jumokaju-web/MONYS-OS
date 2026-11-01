function enteroNoNegativo(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
}

export function resumirProgresoTurno({
  entradaRegistrada = false,
  tareasCargando = true,
  pendientes = 0,
  enProceso = 0,
  terminadas = 0,
} = {}) {
  const completadas = enteroNoNegativo(terminadas);
  const abiertas = enteroNoNegativo(pendientes) + enteroNoNegativo(enProceso);
  const totalTareas = completadas + abiertas;
  const totalAcciones = 1 + totalTareas;
  const accionesCompletas = (entradaRegistrada ? 1 : 0) + completadas;
  const porcentaje = tareasCargando
    ? null
    : Math.round((accionesCompletas / totalAcciones) * 100);

  return {
    accionesCompletas,
    totalAcciones,
    totalTareas,
    porcentaje,
    mensaje: tareasCargando
      ? "Estamos preparando tu día."
      : porcentaje === 100
        ? "¡Excelente! Completaste todo lo asignado para hoy."
        : completadas > 0
          ? `Ya completaste ${completadas} ${completadas === 1 ? "tarea" : "tareas"}. Sigue así.`
          : entradaRegistrada
            ? "Tu entrada está lista. Ahora vamos con tu primera tarea."
            : "Empieza registrando tu entrada para activar tu día.",
  };
}

export function saludoTurno(hora = new Date().getHours()) {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}
