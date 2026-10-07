import test from "node:test";
import assert from "node:assert/strict";
import { generarResumenUtilidadVentas } from "../../src/features/importador/utils/resumenUtilidadVentas.js";

test("resume ventas, costo, utilidad bruta, margen y folios repetidos", () => {
  const resumen = generarResumenUtilidadVentas([
    { folio: "F-001", ventaTotal: 1000, costoTotal: 600, utilidad: 400, periodoInicio: "2026-10-01", periodoFin: "2026-10-07" },
    { folio: "f-001", ventaTotal: 500, costoTotal: 300, utilidad: 200, periodoInicio: "2026-10-01", periodoFin: "2026-10-07" },
    { folio: "F-002", ventaTotal: 500, costoTotal: 350, utilidad: 150, periodoInicio: "2026-10-01", periodoFin: "2026-10-07" },
  ]);

  assert.deepEqual(resumen, {
    tipoResumen: "utilidad_ventas",
    totalRegistros: 3,
    foliosUnicos: 2,
    foliosDuplicados: 1,
    ventaTotal: 2000,
    costoTotal: 1250,
    utilidadTotal: 750,
    margenUtilidad: 37.5,
    fechaInicio: "2026-10-01",
    fechaFin: "2026-10-07",
  });
});

test("un reporte vacío devuelve totales en cero y no divide entre cero", () => {
  const resumen = generarResumenUtilidadVentas([]);
  assert.equal(resumen.totalRegistros, 0);
  assert.equal(resumen.margenUtilidad, 0);
  assert.equal(resumen.foliosDuplicados, 0);
});
