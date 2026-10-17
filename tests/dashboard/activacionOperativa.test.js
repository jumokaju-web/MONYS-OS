import test from "node:test";
import assert from "node:assert/strict";
import { resumirActivacionOperativa } from "../../src/features/dashboard/utils/activacionOperativa.js";

const fuente = (filas) => ({ disponible: true, filas });

function base() {
  return {
    hoy: "2026-10-17",
    finanzas: { disponible: true, datosVigentes: true, movimientosPendientes: 0 },
    empleados: fuente([{ id: "e1", active: true, usuario_id: "u1" }]),
    perfiles: fuente([{ empleado_id: "e1" }]),
    horarios: fuente(Array.from({ length: 7 }, (_, dia) => ({ empleado_id: "e1", dia_semana: dia }))),
    tareas: fuente([]),
    campanas: fuente([]),
    rutas: fuente([]),
    incidenciasFlotilla: fuente([]),
    pnr: fuente([]),
    movimientosFlotilla: fuente([]),
  };
}

test("marca las cuatro áreas listas solo con fuentes comprobadas", () => {
  const resumen = resumirActivacionOperativa(base());
  assert.equal(resumen.listos, 4);
  assert.equal(resumen.prioridad, null);
});

test("no convierte una fuente ausente en cero", () => {
  const datos = base();
  datos.rutas = { disponible: false, filas: [] };
  const flotilla = resumirActivacionOperativa(datos).modulos.find((item) => item.id === "flotilla");
  assert.equal(flotilla.estado, "PENDIENTE");
  assert.equal(flotilla.cifra, null);
  assert.match(flotilla.etiquetaCifra, /Dato pendiente/);
});

test("detecta tareas vencidas del equipo y de Marketing", () => {
  const datos = base();
  datos.tareas = fuente([
    { id: "t1", area: "marketing", estado: "pendiente", fecha: "2026-10-16" },
    { id: "t2", area: "operacion", estado: "en_proceso", fecha: "2026-10-15" },
  ]);
  const resumen = resumirActivacionOperativa(datos);
  const equipo = resumen.modulos.find((item) => item.id === "equipo");
  const marketing = resumen.modulos.find((item) => item.id === "marketing");
  assert.equal(equipo.secundarios.vencidas, 2);
  assert.equal(marketing.secundarios.vencidas, 1);
  assert.equal(resumen.prioridad.id, "equipo");
});

test("una campaña activa sin resultado queda en atención", () => {
  const datos = base();
  datos.campanas = fuente([{ id: "c1", estado: "ACTIVA", resultado: {} }]);
  const marketing = resumirActivacionOperativa(datos).modulos.find((item) => item.id === "marketing");
  assert.equal(marketing.estado, "ATENCION");
  assert.equal(marketing.secundarios.sinResultado, 1);
});

test("Flotilla reúne incidencias PNR y dinero sin conciliación", () => {
  const datos = base();
  datos.rutas = fuente([{ id: "r1", estado: "EN_RUTA" }]);
  datos.incidenciasFlotilla = fuente([{ id: "i1", estado: "EN_REVISION" }]);
  datos.pnr = fuente([{ id: "p1", estado: "EN_INVESTIGACION" }]);
  datos.movimientosFlotilla = fuente([{ id: "m1", estado_conciliacion: "PENDIENTE" }]);
  const flotilla = resumirActivacionOperativa(datos).modulos.find((item) => item.id === "flotilla");
  assert.equal(flotilla.cifra, 1);
  assert.match(flotilla.detalle, /3 revisiones operativas pendientes/);
});
