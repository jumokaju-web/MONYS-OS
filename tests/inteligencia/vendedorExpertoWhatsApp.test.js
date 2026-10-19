import test from "node:test";
import assert from "node:assert/strict";
import {
  analizarConversacionWhatsApp,
  construirSeguimientoWhatsApp,
  normalizarTelefonoWhatsApp,
  prepararBandejaWhatsApp,
} from "../../src/features/inteligencia/shared/vendedorExpertoWhatsApp.js";

test("una queja se escala a Dirección sin prometer devolución", () => {
  const resultado = analizarConversacionWhatsApp({
    mensajeCliente: "El producto llegó roto, quiero reembolso",
  });

  assert.equal(resultado.tipo, "ACLARACION_O_QUEJA");
  assert.equal(resultado.autorizacion, "DIRECCION");
  assert.match(resultado.siguientePaso, /no prometer devolución/i);
  assert.doesNotMatch(resultado.respuesta, /te (haré|haremos|daremos) (el )?reembolso/i);
});

test("un comprobante nunca se convierte automáticamente en pago confirmado", () => {
  const resultado = analizarConversacionWhatsApp({
    mensajeCliente: "Ya pagué por transferencia, aquí está mi comprobante",
  });

  assert.equal(resultado.tipo, "PAGO");
  assert.equal(resultado.autorizacion, "DIRECCION");
  assert.match(resultado.respuesta, /todavía no lo marcaré como pagado/i);
  assert.match(resultado.siguientePaso, /validar el ingreso real/i);
});

test("una solicitud de descuento no inventa promociones", () => {
  const resultado = analizarConversacionWhatsApp({
    mensajeCliente: "¿Me das un descuento?",
    producto: "Labial",
    precioConfirmado: "120",
  });

  assert.equal(resultado.tipo, "DESCUENTO");
  assert.equal(resultado.autorizacion, "DIRECCION");
  assert.match(resultado.respuesta, /promoción autorizada/i);
  assert.doesNotMatch(resultado.respuesta, /\d+%/);
});

test("solo avanza a cotización con precio y existencia confirmados", () => {
  const confirmado = analizarConversacionWhatsApp({
    mensajeCliente: "Quiero comprar el serum",
    producto: "Serum BAUSS",
    disponibilidad: "CONFIRMADA",
    precioConfirmado: "129.50",
    sucursal: "General Anaya",
  });
  const pendiente = analizarConversacionWhatsApp({
    mensajeCliente: "Quiero comprar el serum",
    producto: "Serum BAUSS",
  });

  assert.equal(confirmado.siguienteEtapa, "COTIZANDO");
  assert.match(confirmado.respuesta, /\$129\.50/);
  assert.equal(pendiente.siguienteEtapa, "CONTACTADO");
  assert.ok(pendiente.faltantes.length > 0);
  assert.doesNotMatch(pendiente.respuesta, /\$0/);
});

test("normaliza teléfonos para reutilizar la conversación correcta", () => {
  assert.equal(normalizarTelefonoWhatsApp("+52 (656) 123-45-67"), "6561234567");
  assert.equal(normalizarTelefonoWhatsApp("656 123 4567"), "6561234567");
  assert.equal(normalizarTelefonoWhatsApp(""), "");
});

test("prioriza el mensaje entrante sin respuesta sobre un seguimiento vencido", () => {
  const oportunidades = [
    { id: "seguimiento", canal: "WHATSAPP", etapa: "CONTACTADO", cliente: "Ana", proximo_seguimiento: "2026-10-18" },
    { id: "mensaje", canal: "WHATSAPP", etapa: "COTIZANDO", cliente: "Luz", proximo_seguimiento: "2026-10-20" },
  ];
  const interacciones = [
    { oportunidad_id: "mensaje", direccion: "ENTRANTE", mensaje: "¿Sí lo tienes?", ocurrio_at: "2026-10-19T10:00:00Z" },
    { oportunidad_id: "seguimiento", direccion: "SALIENTE", mensaje: "Quedo pendiente", ocurrio_at: "2026-10-17T10:00:00Z" },
  ];

  const bandeja = prepararBandejaWhatsApp(oportunidades, interacciones, "2026-10-19");

  assert.equal(bandeja[0].id, "mensaje");
  assert.equal(bandeja[0].estadoBandeja, "RESPONDER_AHORA");
  assert.equal(bandeja[1].estadoBandeja, "SEGUIMIENTO_HOY");
});

test("una nota de borrador no se confunde con una respuesta enviada", () => {
  const oportunidades = [{ id: "1", canal: "WHATSAPP", etapa: "CONTACTADO", cliente: "Mara" }];
  const interacciones = [
    { oportunidad_id: "1", direccion: "NOTA", mensaje: "BORRADOR NO ENVIADO", ocurrio_at: "2026-10-19T11:00:00Z" },
    { oportunidad_id: "1", direccion: "ENTRANTE", mensaje: "¿Cuánto cuesta?", ocurrio_at: "2026-10-19T10:00:00Z" },
  ];

  const [item] = prepararBandejaWhatsApp(oportunidades, interacciones, "2026-10-19");

  assert.equal(item.estadoBandeja, "RESPONDER_AHORA");
  assert.equal(item.mensajePendiente, "¿Cuánto cuesta?");
});

test("una respuesta saliente queda esperando clienta y las cerradas no aparecen", () => {
  const oportunidades = [
    { id: "abierta", canal: "WHATSAPP", etapa: "COTIZANDO", cliente: "Sofi" },
    { id: "ganada", canal: "WHATSAPP", etapa: "GANADO", cliente: "Venta cerrada" },
    { id: "perdida", canal: "WHATSAPP", etapa: "PERDIDO", cliente: "No interesada" },
  ];
  const interacciones = [
    { oportunidad_id: "abierta", direccion: "SALIENTE", mensaje: "Te comparto la información", ocurrio_at: "2026-10-19T10:00:00Z" },
  ];

  const bandeja = prepararBandejaWhatsApp(oportunidades, interacciones, "2026-10-19");

  assert.equal(bandeja.length, 1);
  assert.equal(bandeja[0].estadoBandeja, "ESPERANDO_CLIENTA");
});

test("el seguimiento pregunta sin afirmar inventario, precio ni apartado", () => {
  const respuesta = construirSeguimientoWhatsApp({
    cliente: "Claudia",
    producto: "Base tono 3",
    etapa: "COTIZANDO",
  });

  assert.match(respuesta, /Claudia/);
  assert.match(respuesta, /confirmar los últimos datos/i);
  assert.doesNotMatch(respuesta, /disponible|apartado|pagado|\$/i);
});
