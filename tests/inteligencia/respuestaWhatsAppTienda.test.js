import test from "node:test";
import assert from "node:assert/strict";
import { construirRespuestaWhatsAppTienda } from "../../src/features/inteligencia/shared/respuestaWhatsAppTienda.js";

test("pide identificar el producto sin inventar existencia ni precio", () => {
  const resultado = construirRespuestaWhatsAppTienda({ mensajeCliente: "¿Lo tienes?" });
  assert.equal(resultado.estado, "BORRADOR_SEGURO");
  assert.deepEqual(resultado.faltantes, ["producto exacto"]);
  assert.match(resultado.respuesta, /nombre completo o una foto/i);
});

test("solo afirma disponibilidad y precio cuando la empleada los confirmó", () => {
  const resultado = construirRespuestaWhatsAppTienda({
    mensajeCliente: "¿Tienes el serum?",
    producto: "Serum pestañas BAUSS",
    disponibilidad: "CONFIRMADA",
    precioConfirmado: "129.50",
    sucursal: "General Anaya",
  });
  assert.equal(resultado.estado, "LISTA_PARA_REVISAR");
  assert.equal(resultado.faltantes.length, 0);
  assert.match(resultado.respuesta, /\$129\.50/);
  assert.match(resultado.respuesta, /General Anaya/);
});

test("conserva inventario y precio como pendientes cuando no se revisaron", () => {
  const resultado = construirRespuestaWhatsAppTienda({
    mensajeCliente: "Precio de labial",
    producto: "Labial tono 04",
    disponibilidad: "PENDIENTE",
    precioConfirmado: "",
  });
  assert.equal(resultado.estado, "INVENTARIO_Y_PRECIO_PENDIENTES");
  assert.deepEqual(resultado.faltantes, ["existencia confirmada", "precio confirmado"]);
  assert.doesNotMatch(resultado.respuesta, /\$0/);
});

test("no prepara respuesta sin el mensaje real de la clienta", () => {
  const resultado = construirRespuestaWhatsAppTienda({ producto: "Base" });
  assert.equal(resultado.estado, "PENDIENTE");
  assert.equal(resultado.respuesta, "");
});
