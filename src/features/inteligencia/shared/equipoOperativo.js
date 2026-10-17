export function areasSugeridasParaEmpleado(empleado = {}) {
  const responsabilidades = Array.isArray(empleado.responsabilidades)
    ? empleado.responsabilidades
    : [];
  const permitidas = new Set([
    "VENTA_TIENDA",
    "VENTA_WHATSAPP",
    "PUBLICAR_GRUPOS_WHATSAPP",
    "CAJA_CORTE",
    "INVENTARIO_APOYO",
  ]);
  const desdeResponsabilidades = responsabilidades.filter((area) => permitidas.has(area));
  if (desdeResponsabilidades.length) return [...new Set(desdeResponsabilidades)].slice(0, 3);

  const puesto = String(empleado.puesto || "").toLocaleLowerCase("es-MX");
  if (puesto.includes("marketing")) return ["PUBLICAR_GRUPOS_WHATSAPP", "VENTA_WHATSAPP"];
  if (puesto.includes("venta") || puesto.includes("vendedor")) return ["VENTA_TIENDA"];
  return [];
}

export function resumirEquipoOperativo(empleados = [], configuraciones = [], horarios = null) {
  const activos = (Array.isArray(empleados) ? empleados : []).filter((empleado) => empleado?.active !== false);
  const perfiles = new Map((Array.isArray(configuraciones) ? configuraciones : [])
    .map((configuracion) => [String(configuracion.empleado_id), configuracion]));
  const listos = activos.filter((empleado) => perfiles.has(String(empleado.id)));
  const sinAcceso = activos.filter((empleado) => !empleado.auth_user_id);
  const calendarioDisponible = Array.isArray(horarios);
  const diasPorEmpleado = new Map();
  for (const fila of calendarioDisponible ? horarios : []) {
    const id = String(fila?.empleado_id || "");
    if (!id) continue;
    if (!diasPorEmpleado.has(id)) diasPorEmpleado.set(id, new Set());
    diasPorEmpleado.get(id).add(Number(fila.dia_semana));
  }
  const calendariosListos = calendarioDisponible
    ? activos.filter((empleado) => diasPorEmpleado.get(String(empleado.id))?.size === 7).length
    : listos.length;

  return {
    activos: activos.length,
    listos: listos.length,
    pendientes: activos.length - listos.length,
    sinAcceso: sinAcceso.length,
    calendariosListos,
    horariosPendientes: Math.max(0, activos.length - calendariosListos),
    completo: activos.length > 0 && listos.length === activos.length && calendariosListos === activos.length,
  };
}
