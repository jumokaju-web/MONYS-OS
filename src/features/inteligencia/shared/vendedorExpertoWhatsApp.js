import { construirRespuestaWhatsAppTienda } from "./respuestaWhatsAppTienda.js";

function texto(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function normalizar(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function dinero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0
    ? numero.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
    : null;
}

export function normalizarTelefonoWhatsApp(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");
  return digitos.length > 10 ? digitos.slice(-10) : digitos;
}

export function analizarConversacionWhatsApp({
  mensajeCliente,
  producto,
  disponibilidad = "PENDIENTE",
  precioConfirmado,
  sucursal,
} = {}) {
  const mensaje = texto(mensajeCliente);
  const limpio = normalizar(mensaje);
  const articulo = texto(producto);
  const tienda = texto(sucursal) || "la sucursal";
  const precio = dinero(precioConfirmado);

  if (!mensaje) {
    return {
      tipo: "DATO_FALTANTE",
      prioridad: "PENDIENTE",
      requiereRevision: true,
      autorizacion: "EMPLEADA",
      respuesta: "",
      faltantes: ["mensaje de la clienta"],
      siguienteEtapa: "NUEVO",
      siguientePaso: "Pegar el mensaje real antes de preparar una respuesta.",
    };
  }

  if (/queja|molest|roto|rota|defect|devolu|reembols|cambio|mal estado|no sirve/.test(limpio)) {
    return {
      tipo: "ACLARACION_O_QUEJA",
      prioridad: "URGENTE",
      requiereRevision: true,
      autorizacion: "DIRECCION",
      respuesta: "Hola 😊 Gracias por avisarnos. Quiero revisar bien tu caso antes de darte una solución. ¿Me compartes el folio o ticket, una foto del producto y qué ocurrió? En cuanto lo validemos te confirmamos el siguiente paso.",
      faltantes: ["folio o ticket", "evidencia del caso", "decisión autorizada"],
      siguienteEtapa: "CONTACTADO",
      siguientePaso: "Registrar evidencia y escalar a Dirección; no prometer devolución, cambio ni reembolso.",
    };
  }

  if (/descuento|rebaja|mejor precio|precio especial|promocion|mayoreo|distribu|revender/.test(limpio)) {
    const mayoreo = /mayoreo|distribu|revender/.test(limpio);
    return {
      tipo: mayoreo ? "MAYOREO" : "DESCUENTO",
      prioridad: "ALTA",
      requiereRevision: true,
      autorizacion: "DIRECCION",
      respuesta: mayoreo
        ? `¡Hola! 😊 Sí podemos revisar una cotización de mayoreo${articulo ? ` para ${articulo}` : ""}. ¿Cuántas piezas necesitas y de qué productos o tonos? Con esa información te confirmamos disponibilidad y precio autorizado.`
        : `¡Hola! 😊${articulo ? ` El producto que buscas es ${articulo}.` : ""}${precio ? ` Su precio confirmado es ${precio}.` : ""} Permíteme revisar si existe una promoción autorizada antes de ofrecerte un descuento.`,
      faltantes: mayoreo ? ["productos y cantidades", "precio autorizado"] : ["promoción autorizada"],
      siguienteEtapa: "COTIZANDO",
      siguientePaso: "Preparar cotización y pedir autorización; no inventar descuentos.",
    };
  }

  if (/transfer|deposit|pague|pago|comprobante|cuenta|clabe/.test(limpio)) {
    return {
      tipo: "PAGO",
      prioridad: "URGENTE",
      requiereRevision: true,
      autorizacion: "DIRECCION",
      respuesta: "¡Gracias! 😊 Envíame por favor el comprobante completo y la referencia. Lo revisaremos antes de confirmar el pago y la entrega; todavía no lo marcaré como pagado.",
      faltantes: ["comprobante", "referencia", "validación del pago"],
      siguienteEtapa: "COTIZANDO",
      siguientePaso: "Validar el ingreso real antes de confirmar pago, apartado o entrega.",
    };
  }

  if (/envio|mandar|domicilio|paqueter|codigo postal|c\.p\./.test(limpio)) {
    return {
      tipo: "ENVIO",
      prioridad: "ALTA",
      requiereRevision: true,
      autorizacion: "EMPLEADA",
      respuesta: `¡Claro! 😊 Podemos revisar el envío${articulo ? ` de ${articulo}` : ""}. Compárteme tu ciudad y código postal para confirmar cobertura, costo y tiempo antes de cerrar el pedido.`,
      faltantes: ["ciudad", "código postal", "costo de envío confirmado"],
      siguienteEtapa: "COTIZANDO",
      siguientePaso: "Confirmar destino, costo y plazo reales antes de cobrar.",
    };
  }

  const base = construirRespuestaWhatsAppTienda({
    mensajeCliente: mensaje,
    producto: articulo,
    disponibilidad,
    precioConfirmado,
    sucursal: tienda,
  });
  const quiereComprar = /separ|apart|quiero|comprar|pedido|me lo llevo/.test(limpio);
  return {
    tipo: quiereComprar ? "INTENCION_DE_COMPRA" : "PRODUCTO_PRECIO_EXISTENCIA",
    prioridad: quiereComprar ? "ALTA" : "NORMAL",
    requiereRevision: true,
    autorizacion: "EMPLEADA",
    respuesta: base.respuesta,
    faltantes: base.faltantes,
    siguienteEtapa: disponibilidad === "CONFIRMADA" && precio ? "COTIZANDO" : "CONTACTADO",
    siguientePaso: base.faltantes.length
      ? `Confirmar ${base.faltantes.join(" y ")} antes de cerrar el pedido.`
      : "Enviar la respuesta revisada y preguntar si desea separar o finalizar su pedido.",
  };
}

export function construirSeguimientoWhatsApp({ cliente, producto, etapa } = {}) {
  const nombre = texto(cliente) || "hola";
  const articulo = texto(producto);
  if (etapa === "COTIZANDO") {
    return `Hola, ${nombre} 😊 Doy seguimiento a tu cotización${articulo ? ` de ${articulo}` : ""}. ¿Quieres que te ayude a confirmar los últimos datos y finalizar tu pedido?`;
  }
  return `Hola, ${nombre} 😊 Sigo pendiente para ayudarte${articulo ? ` con ${articulo}` : " con tu compra"}. ¿Todavía lo estás buscando?`;
}

function fechaComparable(valor) {
  const fecha = texto(valor);
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null;
}

export function prepararBandejaWhatsApp(oportunidades = [], interacciones = [], hoy = new Date().toISOString().slice(0, 10)) {
  const conversaciones = new Map();
  for (const interaccion of Array.isArray(interacciones) ? interacciones : []) {
    const id = interaccion?.oportunidad_id;
    if (!id) continue;
    const grupo = conversaciones.get(id) || [];
    grupo.push(interaccion);
    conversaciones.set(id, grupo);
  }

  return (Array.isArray(oportunidades) ? oportunidades : [])
    .filter((item) => item?.canal === "WHATSAPP" && !["GANADO", "PERDIDO"].includes(item?.etapa))
    .map((item) => {
      const historial = (conversaciones.get(item.id) || [])
        .slice()
        .sort((a, b) => String(b.ocurrio_at || "").localeCompare(String(a.ocurrio_at || "")));
      const mensajes = historial.filter((fila) => ["ENTRANTE", "SALIENTE"].includes(fila.direccion));
      const ultimoMensaje = mensajes[0] || null;
      const entradaPendiente = ultimoMensaje?.direccion === "ENTRANTE" ? ultimoMensaje : null;
      const seguimiento = fechaComparable(item.proximo_seguimiento);
      const vencido = seguimiento ? seguimiento <= hoy : false;
      let estado = "SIN_SIGUIENTE_PASO";
      let prioridad = 35;
      let siguientePaso = "Definir la siguiente fecha o cerrar la oportunidad con evidencia.";
      if (entradaPendiente) {
        estado = "RESPONDER_AHORA";
        prioridad = 100;
        siguientePaso = "Revisar el mensaje y enviar una respuesta segura.";
      } else if (vencido) {
        estado = "SEGUIMIENTO_HOY";
        prioridad = 80;
        siguientePaso = "Retomar la conversación y registrar el resultado.";
      } else if (seguimiento) {
        estado = "PROGRAMADA";
        prioridad = 50;
        siguientePaso = `Seguimiento programado para ${seguimiento}.`;
      } else if (ultimoMensaje?.direccion === "SALIENTE") {
        estado = "ESPERANDO_CLIENTA";
        prioridad = 30;
        siguientePaso = "Esperar respuesta o programar una fecha de seguimiento.";
      }
      return {
        ...item,
        estadoBandeja: estado,
        prioridadBandeja: prioridad,
        siguientePaso,
        mensajePendiente: entradaPendiente?.mensaje || "",
        ultimoMensaje,
        conversaciones: historial.length,
      };
    })
    .sort((a, b) => b.prioridadBandeja - a.prioridadBandeja
      || String(a.proximo_seguimiento || "9999-12-31").localeCompare(String(b.proximo_seguimiento || "9999-12-31"))
      || String(b.created_at || "").localeCompare(String(a.created_at || "")));
}
