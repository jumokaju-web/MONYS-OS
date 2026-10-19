function texto(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function dinero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0
    ? numero.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
    : null;
}

export function construirRespuestaWhatsAppTienda({
  mensajeCliente,
  producto,
  disponibilidad = "PENDIENTE",
  precioConfirmado,
  sucursal,
} = {}) {
  const mensaje = texto(mensajeCliente);
  const articulo = texto(producto);
  const tienda = texto(sucursal) || "la sucursal";
  const precio = dinero(precioConfirmado);

  if (!mensaje) {
    return { respuesta: "", estado: "PENDIENTE", faltantes: ["mensaje de la clienta"] };
  }

  if (!articulo) {
    return {
      respuesta: "¡Hola! 😊 Gracias por escribir a Monys Glam. ¿Me compartes el nombre completo o una foto del producto que buscas? Así confirmo exactamente existencia y precio antes de responderte.",
      estado: "BORRADOR_SEGURO",
      faltantes: ["producto exacto"],
    };
  }

  if (disponibilidad === "CONFIRMADA") {
    return {
      respuesta: `¡Hola! 😊 Sí tenemos ${articulo} disponible en ${tienda}.${precio ? ` El precio confirmado es ${precio}.` : " Permíteme confirmarte el precio antes de cerrar tu pedido."} ¿Quieres que te lo separe?`,
      estado: precio ? "LISTA_PARA_REVISAR" : "PRECIO_PENDIENTE",
      faltantes: precio ? [] : ["precio confirmado"],
    };
  }

  if (disponibilidad === "AGOTADA_CONFIRMADA") {
    return {
      respuesta: `¡Hola! 😊 Revisé ${articulo} y por ahora no tenemos existencia confirmada en ${tienda}. Puedo ayudarte a revisar otra sucursal o registrar tu solicitud para avisarte cuando vuelva a estar disponible.`,
      estado: "LISTA_PARA_REVISAR",
      faltantes: [],
    };
  }

  return {
    respuesta: `¡Hola! 😊 Gracias por escribir a Monys Glam. Déjame confirmar la existencia y el precio de ${articulo} en ${tienda} para darte información correcta. En cuanto lo revise te respondo.`,
    estado: "INVENTARIO_Y_PRECIO_PENDIENTES",
    faltantes: ["existencia confirmada", "precio confirmado"],
  };
}
