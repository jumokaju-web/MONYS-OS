const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const CANALES = ["INSTAGRAM", "TIKTOK", "FACEBOOK", "WHATSAPP", "INSTAGRAM", "TIKTOK_SHOP", "MERCADO_LIBRE"];
const FORMATOS = ["Reel", "Video corto", "Carrusel", "Estado", "Historia", "Video de producto", "Ficha optimizada"];
const ENFOQUES = [
  ["DESCUBRIR", "Presentar una necesidad real que resuelve el producto"],
  ["DEMOSTRAR", "Mostrar uso, resultado o diferencia con claridad"],
  ["CONFIANZA", "Responder una duda frecuente antes de comprar"],
  ["CONVERTIR", "Invitar a preguntar, apartar o comprar sin inventar ofertas"],
  ["RECORDAR", "Mantener presente el producto con una pieza breve"],
  ["VENDER", "Llevar a la ficha o conversación de compra"],
  ["MEDIR", "Revisar respuestas y convertir el aprendizaje en la siguiente prueba"],
];

function fechaLocal(fecha) {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate(), 12, 0, 0, 0);
}

export function claveFechaLocal(fecha) {
  const valor = fechaLocal(fecha);
  const mes = String(valor.getMonth() + 1).padStart(2, "0");
  const dia = String(valor.getDate()).padStart(2, "0");
  return `${valor.getFullYear()}-${mes}-${dia}`;
}

export function inicioSemanaContenido(fecha = new Date()) {
  return fechaLocal(fecha);
}

function productoReciente(clienteId, publicaciones, productoPreferido) {
  const reciente = publicaciones.find((publicacion) =>
    publicacion?.cliente_agencia_id === clienteId &&
    Array.isArray(publicacion?.productos) &&
    publicacion.productos.some((producto) => String(producto?.nombre || "").trim())
  );
  return String(reciente?.productos?.[0]?.nombre || productoPreferido || "").trim();
}

export function generarPlanSemanalContenido({
  clientes = [],
  publicaciones = [],
  productoPreferido = "",
  fechaBase = new Date(),
} = {}) {
  const activos = (Array.isArray(clientes) ? clientes : []).filter((cliente) => cliente?.estado === "ACTIVO");
  if (!activos.length) return [];

  const inicio = inicioSemanaContenido(fechaBase);
  const ordenadas = [...(Array.isArray(publicaciones) ? publicaciones : [])].sort(
    (a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0)
  );

  return Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(inicio);
    fecha.setDate(inicio.getDate() + indice);
    const cliente = activos[indice % activos.length];
    const producto = productoReciente(cliente.id, ordenadas, productoPreferido);
    const canal = CANALES[indice];
    const programada = ordenadas.find((publicacion) =>
      publicacion?.cliente_agencia_id === cliente.id &&
      Array.isArray(publicacion?.canales) && publicacion.canales.includes(canal) &&
      publicacion?.programada_para && claveFechaLocal(publicacion.programada_para) === claveFechaLocal(fecha)
    );

    return {
      id: `${claveFechaLocal(fecha)}-${cliente.id}-${canal}`,
      fecha: claveFechaLocal(fecha),
      dia: DIAS[fecha.getDay()],
      clienteId: cliente.id,
      cliente: cliente.nombre,
      objetivoNegocio: cliente.objetivo_principal || "Objetivo del negocio por confirmar",
      producto: producto || "Producto por confirmar",
      productoConfirmado: Boolean(producto),
      canal,
      formato: FORMATOS[indice],
      enfoque: ENFOQUES[indice][0],
      instruccion: ENFOQUES[indice][1],
      estado: programada ? "AGENDADO" : producto ? "PROPUESTA" : "FALTA_DATO",
      publicacionId: programada?.id || null,
    };
  });
}
