import test from "node:test";
import assert from "node:assert/strict";
import { analizarCentroDireccionCRM } from "../../src/features/inteligencia/shared/centroDireccionCRM.js";

const ahora = Date.parse("2026-10-19T18:00:00Z");

test("Dirección prioriza oportunidades sin responsable, entrantes pendientes y cotizaciones", () => {
  const resultado = analizarCentroDireccionCRM({
    hoy: "2026-10-19",
    ahora,
    oportunidades: [
      { id: "sin-asignar", cliente: "Ana", etapa: "NUEVO" },
      { id: "responder", cliente: "Luz", etapa: "CONTACTADO", asignado_a: "u1", empleado_id: "e1" },
      { id: "cotizar", cliente: "Mara", etapa: "COTIZANDO", asignado_a: "u1", empleado_id: "e1" },
    ],
    interacciones: [{ oportunidad_id: "responder", direccion: "ENTRANTE", ocurrio_at: "2026-10-19T16:00:00Z" }],
  });
  assert.equal(resultado.sinResponsable, 1);
  assert.equal(resultado.cotizaciones, 1);
  assert.deepEqual(resultado.acciones.slice(0, 3).map((fila) => fila.categoria), ["SIN_RESPONSABLE", "RESPONDER", "COTIZACION"]);
  assert.match(resultado.acciones[0].accion, /Asignar/);
});

test("mide primera respuesta usando marcas registradas y excluye notas", () => {
  const resultado = analizarCentroDireccionCRM({
    hoy: "2026-10-19",
    ahora,
    oportunidades: [{ id: "a", etapa: "GANADO", folio_venta_sicar: "F-1", branch_id: "b1", empleado_id: "e1", canal: "WHATSAPP", producto_interes: "Base" }],
    sucursales: [{ id: "b1", name: "Centro" }],
    interacciones: [
      { oportunidad_id: "a", direccion: "NOTA", ocurrio_at: "2026-10-19T09:00:00Z", mensaje: "BORRADOR" },
      { oportunidad_id: "a", direccion: "ENTRANTE", ocurrio_at: "2026-10-19T10:00:00Z" },
      { oportunidad_id: "a", direccion: "SALIENTE", ocurrio_at: "2026-10-19T10:12:00Z", mensaje: "Te confirmo la existencia" },
    ],
  });
  assert.equal(resultado.primeraRespuesta.medianaMinutos, 12);
  assert.equal(resultado.primeraRespuesta.muestra, 1);
  assert.equal(resultado.textosAsociados.length, 1);
  assert.equal(resultado.ventasSicar, 1);
  assert.equal(resultado.porSucursal[0].nombre, "Centro");
  assert.equal(resultado.porResponsable[0].ganadas, 1);
});

test("filtro por sucursal no mezcla indicadores y motivo ausente sigue visible", () => {
  const resultado = analizarCentroDireccionCRM({
    hoy: "2026-10-19",
    ahora,
    sucursalId: "b1",
    oportunidades: [
      { id: "p1", etapa: "PERDIDO", branch_id: "b1", ultimo_resultado: "Motivo de pérdida: No había existencia" },
      { id: "p2", etapa: "PERDIDO", branch_id: "b2" },
      { id: "open", etapa: "NUEVO", branch_id: "b2" },
    ],
  });
  assert.equal(resultado.total, 1);
  assert.equal(resultado.razonesPerdida.length, 1);
  assert.equal(resultado.perdidasSinMotivo, 0);
});

test("marca cotizaciones sin respuesta tras tres días como regla operativa", () => {
  const resultado = analizarCentroDireccionCRM({
    hoy: "2026-10-19",
    ahora,
    oportunidades: [{ id: "a", etapa: "COTIZANDO", asignado_a: "u1" }],
    interacciones: [
      { oportunidad_id: "a", direccion: "ENTRANTE", ocurrio_at: "2026-10-15T09:00:00Z" },
      { oportunidad_id: "a", direccion: "SALIENTE", ocurrio_at: "2026-10-15T10:00:00Z" },
    ],
  });
  assert.equal(resultado.sinRespuesta, 1);
  assert.match(resultado.acciones[0].accion, /3 días/);
});
