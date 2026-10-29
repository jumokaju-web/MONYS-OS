import test from "node:test";
import assert from "node:assert/strict";
import { construirInteligenciaConsejo } from "../../src/features/inteligencia/utils/inteligenciaConsejo.js";
import { generarDecisionCEO } from "../../src/features/inteligencia/ia/ceo/directorGeneralIA.js";
import { generarAnalisisFinanciero } from "../../src/features/inteligencia/ia/directorFinancieroIA.js";

const datosDashboard = { metricas: { fechaFinal: "2026-10-25" }, inventario: { detalles: [{}] }, inteligencia: { comercial: { ventas: [{}] } } };
const ahora = Date.parse("2026-10-28T18:00:00Z");
const acciones = Array.from({ length: 14 }, (_, i) => ({ titulo: `Propuesta ${i + 1}`, descripcion: `Revisar caso ${i + 1}`, prioridad: i < 5 ? "CRITICA" : "MEDIA" }));

test("el Consejo conserva más de cinco propuestas y solo destaca tres", () => {
  const r = construirInteligenciaConsejo({ datosDashboard, ahora, marketing: { agendaCompleta: acciones, accionesPrioritarias: acciones.slice(0, 5) } });
  assert.equal(r.prioridades.length, 14);
  assert.equal(r.prioridadesDestacadas.length, 3);
  assert(r.prioridades.some((p) => p.titulo === "Propuesta 14"));
  assert.equal(r.prioridades.filter((p) => p.prioridad === "CRITICA").length, 5);
});

test("pagos y equipo se integran sin confundir coincidencias de título con duplicados", () => {
  const a = { titulo: "Revisar pendientes", descripcion: "Comprobar la fuente", prioridad: "ALTA" };
  const r = construirInteligenciaConsejo({ datosDashboard, ahora, financiero: { agendaCompleta: [a, { ...a }] }, rh: { agendaCompleta: [a] } });
  assert.equal(r.prioridades.length, 2);
  assert.deepEqual(new Set(r.prioridades.map((p) => p.director)), new Set(["financiero", "rh"]));
});

test("una fecha Date válida mantiene el criterio de vigencia y un corte antiguo no produce campañas", () => {
  const r = construirInteligenciaConsejo({ datosDashboard: { ...datosDashboard, metricas: { fechaFinal: new Date("2026-10-25T12:00:00Z") } }, ahora, marketing: { agendaCompleta: acciones } });
  assert.equal(r.vigente, true);
  assert.equal(r.prioridades.length, 14);
  const viejo = construirInteligenciaConsejo({ datosDashboard: { ...datosDashboard, metricas: { fechaFinal: "2026-01-01" } }, ahora, marketing: { agendaCompleta: acciones } });
  assert.equal(viejo.prioridades.some((p) => p.director === "marketing"), false);
});

test("el CEO conserva la agenda financiera completa sin habilitar dinero ni compras", () => {
  const r = generarDecisionCEO({ analisisFinanciero: { agendaCompleta: acciones, accionesPrioritarias: acciones.slice(0, 5) } });
  assert.equal(r.decisiones.length, 14);
  assert.equal(r.decisionesDestacadas.length, 3);
  assert.equal(r.resumen.decisionesTotales, 14);
  assert.equal(r.dineroDisponible, null);
  assert.equal(r.presupuestoCompraAutorizado, 0);
  assert.deepEqual(r.comprasAutorizadas, []);
});

test("el director financiero mantiene un resumen compatible junto con sus propuestas completas", () => {
  const r = generarAnalisisFinanciero({});
  assert(Array.isArray(r.agendaCompleta));
  assert.deepEqual(r.accionesPrioritarias, r.agendaCompleta.slice(0, 5));
});
