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
