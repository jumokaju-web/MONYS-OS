import test from "node:test";
import assert from "node:assert/strict";
import { calcularMetricasDashboard } from "../../src/features/dashboard/utils/dashboardMetrics.js";

test("usa el reporte de utilidad cuando contiene importes y conserva su propio periodo", () => {
  const resultado = calcularMetricasDashboard(
    [{ fecha: "2026-09-22", importe: 999, cantidad: 1 }],
    [{ fecha: "2026-09-28", importe: 200, costo: 120, utilidad: 80 }]
  );

  assert.equal(resultado.fuenteFinanciera, "utilidad");
  assert.equal(resultado.tieneDatosFinancieros, true);
  assert.equal(resultado.ventasTotales, 200);
  assert.equal(resultado.utilidadTotal, 80);
  assert.equal(resultado.fechaInicial.toISOString().slice(0, 10), "2026-09-28");
});

test("usa ventas por artículo si el reporte de utilidad no contiene importes", () => {
  const resultado = calcularMetricasDashboard(
    [{ fecha: "2026-10-02", importe: 150, costo: 90, utilidad: 60, cantidad: 2 }],
    [{ fecha: "2026-09-20", importe: 0, costo: 0, utilidad: 0 }]
  );

  assert.equal(resultado.fuenteFinanciera, "ventas");
  assert.equal(resultado.tieneDatosFinancieros, true);
  assert.equal(resultado.ventasTotales, 150);
  assert.equal(resultado.fechaInicial.toISOString().slice(0, 10), "2026-10-02");
});

test("no presenta cero como una cifra financiera real si SICAR no trae importes", () => {
  const resultado = calcularMetricasDashboard([], []);

  assert.equal(resultado.fuenteFinanciera, null);
  assert.equal(resultado.tieneDatosFinancieros, false);
});
