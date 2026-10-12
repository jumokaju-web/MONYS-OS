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
  if (/venta|vendedor|vendedora|tienda/.test(puesto)) {
    return ["VENTA_TIENDA"];
  }
  return [];
}

export function detalleResponsabilidadesEmpleado(usuario = {}) {
  const seleccionadas = new Set(resolverResponsabilidadesEmpleado(usuario));
  return RESPONSABILIDADES_EMPLEADO.filter((item) => seleccionadas.has(item.id));
}
