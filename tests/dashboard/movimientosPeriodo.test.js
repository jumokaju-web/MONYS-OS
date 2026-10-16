import test from "node:test";
import assert from "node:assert/strict";
import { obtenerFechaMovimiento } from "../../src/features/dashboard/utils/movimientosPeriodo.js";

test("prefiere la fecha ISO de Tesorería sobre la fecha localizada para pantalla", () => {
  const fecha = obtenerFechaMovimiento({
    occurred_at: "2026-10-11T11:20:09.000Z",
    fecha: "11/10/2026, 5:20:09 a.m.",
  });

  assert.equal(fecha?.toISOString(), "2026-10-11T11:20:09.000Z");
});

test("usa una fecha ISO alternativa cuando la fecha principal falta", () => {
  const fecha = obtenerFechaMovimiento({
    occurred_at: null,
    fecha_iso: "2026-10-05",
  });

  assert.equal(fecha?.getFullYear(), 2026);
  assert.equal(fecha?.getMonth(), 9);
  assert.equal(fecha?.getDate(), 5);
});

test("mantiene inválida una fecha localizada que no puede interpretarse sin ambigüedad", () => {
  assert.equal(
    obtenerFechaMovimiento({ fecha: "11/10/2026, 5:20:09 a.m." }),
    null
  );
});
