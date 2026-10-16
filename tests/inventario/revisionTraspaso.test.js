import test from "node:test";
import assert from "node:assert/strict";

import {
  construirVerificacionesTraspaso,
  crearResultadoRevisionTraspaso,
  leerRevisionTraspaso,
  validarCapturaRevisionTraspaso,
} from "../../src/features/inventario/shared/revisionTraspaso.js";
import { leerExistenciaReportada } from "../../src/features/inventario/shared/existenciaReportada.js";

const recomendaciones = [
  {
    prioridad: "ALTA",
    producto: "Base tono 2",
    productId: "producto-1",
    branchOrigenId: "centro",
    branchDestinoId: "anaya",
    sucursalOrigen: "Centro",
    sucursalDestino: "General Anaya",
    cantidadSugerida: 5,
    existenciaOrigen: 18,
    existenciaDestino: 1,
    coberturaOrigen: 44,
    coberturaDestino: 2,
    ventasOrigen: 3,
    ventasDestino: 7,
    periodoInicio: "2026-10-01",
    periodoFin: "2026-10-07",
    diasAnalizados: 7,
  },
  {
    prioridad: "ALTA",
    producto: "Rímel negro",
    productId: "producto-2",
    branchOrigenId: "anaya",
    branchDestinoId: "centro",
    sucursalOrigen: "General Anaya",
    sucursalDestino: "Centro",
    cantidadSugerida: 2,
    existenciaOrigen: 12,
    existenciaDestino: 4,
    coberturaOrigen: 40,
    coberturaDestino: 8,
    ventasOrigen: 2,
    ventasDestino: 5,
    periodoInicio: "2026-10-01",
    periodoFin: "2026-10-07",
    diasAnalizados: 7,
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    prioridad: "ALTA",
    producto: `Producto ${index + 3}`,
    branchOrigenId: "centro",
    branchDestinoId: "anaya",
    sucursalOrigen: "Centro",
    sucursalDestino: "General Anaya",
    cantidadSugerida: 1,
  })),
];

test("asigna máximo dos revisiones por sucursal y cubre ambas direcciones", () => {
  const tareas = construirVerificacionesTraspaso(recomendaciones);
  const centro = tareas.filter((item) => item.branchId === "centro");
  const anaya = tareas.filter((item) => item.branchId === "anaya");

  assert.equal(centro.length, 2);
  assert.equal(anaya.length, 2);
  assert.deepEqual(centro.map((item) => item.lado).sort(), ["DESTINO", "ORIGEN"]);
  assert.deepEqual(anaya.map((item) => item.lado).sort(), ["DESTINO", "ORIGEN"]);
});

test("guarda el contexto SICAR de la recomendación para que la empleada vea fuente y periodo", () => {
  const tarea = construirVerificacionesTraspaso(recomendaciones)[0];
  const contexto = leerRevisionTraspaso({ titulo: tarea.titulo, instrucciones: tarea.instrucciones });

  assert.equal(contexto.producto, tarea.recomendacion.producto);
  assert.equal(contexto.periodoInicio, "2026-10-01");
  assert.equal(contexto.periodoFin, "2026-10-07");
  assert.equal(contexto.cantidadSugerida, tarea.recomendacion.cantidadSugerida);
});

test("exige conteo entero explícito y acepta cero confirmado físicamente", () => {
  assert.equal(validarCapturaRevisionTraspaso({ lado: "ORIGEN", existenciaFisica: "", decision: "hay_excedente" }), false);
  assert.equal(validarCapturaRevisionTraspaso({ lado: "ORIGEN", existenciaFisica: "2.5", decision: "hay_excedente" }), false);
  assert.equal(validarCapturaRevisionTraspaso({ lado: "ORIGEN", existenciaFisica: "0", decision: "hay_excedente" }), true);
  assert.equal(validarCapturaRevisionTraspaso({ lado: "DESTINO", existenciaFisica: "0", decision: "si_hace_falta" }), true);
  assert.equal(validarCapturaRevisionTraspaso({ lado: "DESTINO", existenciaFisica: "0", decision: "hay_excedente" }), false);

  const resultado = crearResultadoRevisionTraspaso({ lado: "DESTINO", existenciaFisica: "0", decision: "si_hace_falta", observaciones: "Verificado en anaquel" });
  assert.match(resultado, /"existenciaFisica":0/);
  assert.match(resultado, /Verificado en anaquel/);
});

test("distingue existencia real en cero de inventario ausente o inválido", () => {
  assert.equal(leerExistenciaReportada({ existencia: 0 }), 0);
  assert.equal(leerExistenciaReportada({ existencia: "0" }), 0);
  assert.equal(leerExistenciaReportada({}), null);
  assert.equal(leerExistenciaReportada({ existencia: "" }), null);
  assert.equal(leerExistenciaReportada({ existencia: "no disponible" }), null);
  assert.equal(leerExistenciaReportada({ existencia: "no disponible", datos_originales: { stock: 4 } }), 4);
});
