export function resolverAccesosTienda({
  responsabilidades = [],
  permisos = [],
} = {}) {
  const responsabilidadesEfectivas = new Set(
    Array.isArray(responsabilidades) ? responsabilidades : [],
  );
  const permisosEfectivos = new Set(
    Array.isArray(permisos) ? permisos : [],
  );

  const participaEnVentaOInventario = [
    "VENTA_TIENDA",
    "VENTA_WHATSAPP",
    "INVENTARIO_APOYO",
  ].some((responsabilidad) =>
    responsabilidadesEfectivas.has(responsabilidad),
  );

  return {
    puedeCaja: responsabilidadesEfectivas.has("CAJA_CORTE"),
    puedeWhatsApp: responsabilidadesEfectivas.has("VENTA_WHATSAPP"),
    puedeRegistrarIncidencias: permisosEfectivos.has("registrar_incidencias"),
    puedeRegistrarProducto:
      participaEnVentaOInventario &&
      permisosEfectivos.has("registrar_producto_solicitado"),
  };
}

export function crearRutaTurnoTienda({
  puedeRegistrarProducto = false,
  puedeWhatsApp = false,
  puedeRegistrarIncidencias = false,
  puedeCaja = false,
} = {}) {
  const registrosDisponibles = [
    puedeWhatsApp && "mensajes",
    puedeRegistrarProducto && "solicitudes",
    puedeRegistrarIncidencias && "incidencias",
  ].filter(Boolean);

  const pasoRegistro = registrosDisponibles.length
    ? {
        titulo: "Lo que pasó",
        descripcion: `Deja ${registrosDisponibles.join(" e ")} con datos claros.`,
      }
    : {
        titulo: "Seguimiento",
        descripcion: "Actualiza tus tareas con el resultado real.",
      };

  const pasoCierre = puedeCaja
    ? {
        titulo: "Caja y cierre",
        descripcion: "Completa caja antes de terminar.",
      }
    : {
        titulo: "Cierre de turno",
        descripcion: "Revisa pendientes y deja tu trabajo actualizado.",
      };

  return [
    { titulo: "Entrada", descripcion: "Confirma que ya comenzaste." },
    {
      titulo: "Tareas y ventas",
      descripcion: "Atiende lo asignado y registra el resultado.",
    },
    pasoRegistro,
    pasoCierre,
  ];
}

export function resolverSiguienteAccionTurno({
  jornadaCargando = true,
  entradaRegistrada = false,
  salidaRegistrada = false,
  tareasCargando = true,
  tareasPendientes = 0,
  tareasEnProceso = 0,
} = {}) {
  if (jornadaCargando) {
    return {
      id: "REVISANDO",
      titulo: "Revisando tu jornada",
      descripcion: "MONYS está confirmando tu entrada antes de indicarte el siguiente paso.",
    };
  }

  if (!entradaRegistrada) {
    return {
      id: "ENTRADA",
      titulo: "Registra tu entrada",
      descripcion: "Confirma tu llegada real para que Dirección sepa que ya estás disponible.",
    };
  }

  if (tareasCargando) {
    return {
      id: "REVISANDO",
      titulo: "Preparando tu trabajo",
      descripcion: "MONYS está consultando las tareas que Dirección te asignó.",
    };
  }

  if (Number(tareasEnProceso) > 0) {
    return {
      id: "TAREAS",
      titulo: `Continúa ${Number(tareasEnProceso) === 1 ? "tu tarea iniciada" : "tus tareas iniciadas"}`,
      descripcion: "Registra el resultado y la evidencia que pida cada actividad.",
    };
  }

  if (Number(tareasPendientes) > 0) {
    return {
      id: "TAREAS",
      titulo: `Empieza ${Number(tareasPendientes) === 1 ? "tu tarea pendiente" : `tus ${Number(tareasPendientes)} tareas pendientes`}`,
      descripcion: "Abre primero la prioridad indicada por MONYS.",
    };
  }

  if (salidaRegistrada) {
    return {
      id: "FINALIZADO",
      titulo: "Jornada registrada",
      descripcion: "Tu salida quedó guardada. Los reportes y cierres pendientes conservan su estado real.",
    };
  }

  return {
    id: "PLAN",
    titulo: "Confirma tu plan con Dirección",
    descripcion: "No hay tareas abiertas. Esto no significa que el turno terminó: actualiza y confirma qué sigue.",
  };
}
