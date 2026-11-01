export const RESPONSABILIDADES_EMPLEADO = [
  {
    id: "VENTA_TIENDA",
    icono: "🛍️",
    nombre: "Venta en tienda",
    descripcion: "Atender, recomendar, cerrar la venta y registrar faltantes.",
  },
  {
    id: "VENTA_WHATSAPP",
    icono: "💬",
    nombre: "Ventas por WhatsApp",
    descripcion: "Responder mensajes, dar seguimiento y cerrar pedidos desde el celular.",
  },
  {
    id: "PUBLICAR_GRUPOS_WHATSAPP",
    icono: "📣",
    nombre: "Publicar en grupos",
    descripcion: "Compartir promociones autorizadas en grupos de WhatsApp y reportar respuesta.",
  },
  {
    id: "CAJA_CORTE",
    icono: "💵",
    nombre: "Caja y corte",
    descripcion: "Abrir caja, entregar fondo, cerrar y subir evidencia del corte.",
  },
  {
    id: "INVENTARIO_APOYO",
    icono: "📦",
    nombre: "Apoyo de inventario",
    descripcion: "Revisar existencias, correcciones y acomodo cuando se le asigne.",
  },
  {
    id: "PEDIDOS_EN_LINEA",
    icono: "🧾",
    nombre: "Pedidos en línea",
    descripcion: "Confirmar productos, preparar pedidos y dejar su resultado actualizado.",
  },
  {
    id: "ENVIOS_TIENDA",
    icono: "📦",
    nombre: "Envíos de tienda",
    descripcion: "Preparar paquetes, registrar guía o evidencia y confirmar la entrega a mensajería.",
  },
  {
    id: "PROPONER_REPOSICION",
    icono: "↔️",
    nombre: "Proponer compra o traspaso",
    descripcion: "Reportar faltantes y sugerir reposición; Dirección conserva la autorización de dinero.",
  },
  {
    id: "OPERACION_SOLA",
    icono: "🌸",
    nombre: "Operación sola en tienda",
    descripcion: "Priorizar clientas, pedidos urgentes y cierre; los conteos se trabajan en lotes pequeños.",
  },
];

const IDS_VALIDOS = new Set(RESPONSABILIDADES_EMPLEADO.map((item) => item.id));

function normalizar(valor) {
  return String(valor || "")
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function limpiarResponsabilidadesEmpleado(responsabilidades = []) {
  return [...new Set(
    (Array.isArray(responsabilidades) ? responsabilidades : [])
      .map((valor) => String(valor || "").trim().toUpperCase())
      .filter((valor) => IDS_VALIDOS.has(valor)),
  )];
}

export function resolverResponsabilidadesEmpleado(usuario = {}) {
  const guardadas = limpiarResponsabilidadesEmpleado(usuario?.responsabilidades);
  if (guardadas.length) return guardadas;

  const puesto = normalizar(`${usuario?.puesto || ""} ${usuario?.role || ""}`);
  if (/encargad/.test(puesto)) {
    return ["VENTA_TIENDA", "CAJA_CORTE", "INVENTARIO_APOYO"];
  }
  if (/super\s*vendedora|supervendedora/.test(puesto)) {
    return [
      "VENTA_TIENDA",
      "VENTA_WHATSAPP",
      "PUBLICAR_GRUPOS_WHATSAPP",
      "INVENTARIO_APOYO",
      "PEDIDOS_EN_LINEA",
      "ENVIOS_TIENDA",
      "PROPONER_REPOSICION",
      "OPERACION_SOLA",
    ];
  }
  if (/venta|vendedor|vendedora|tienda/.test(puesto)) {
    return ["VENTA_TIENDA"];
  }
  return [];
}

export function resolverAreasPerfilEmpleado(usuario = {}) {
  // El perfil operativo usa los mismos identificadores que las
  // responsabilidades de RH. Conservamos todas las funciones autorizadas:
  // una sucursal atendida por una sola persona puede requerir más de tres.
  return resolverResponsabilidadesEmpleado(usuario);
}

export function detalleResponsabilidadesEmpleado(usuario = {}) {
  const seleccionadas = new Set(resolverResponsabilidadesEmpleado(usuario));
  return RESPONSABILIDADES_EMPLEADO.filter((item) => seleccionadas.has(item.id));
}
