import test from "node:test";
import assert from "node:assert/strict";
import {
  ESTADOS_IMPACTO,
  calcularRoasHistorico,
  pronosticarCampana,
} from "../../src/core/impacto/motorImpactoDinero.js";
import { historialCampanasConfirmadas } from "../../src/features/inteligencia/shared/resumenResultadosGrowth.js";

test("ROAS histórico usa la mediana para no inflarse con una campaña excepcional", () => {
  const historico = calcularRoasHistorico([
    { venta: 2000, gasto: 1000 },
    { venta: 3000, gasto: 1000 },
    { venta: 40000, gasto: 1000 },
    { venta: 500, gasto: 0 },
  ]);
  assert.equal(historico.roas, 3);
  assert.equal(historico.campanas, 3);
  assert.equal(historico.confianza, "media");
});

test("pronostica venta y ganancia con presupuesto, margen e historial", () => {
  const pronostico = pronosticarCampana({
    presupuesto: 500,
    margenBruto: 0.4,
    historial: [{ venta: 4000, gasto: 1000 }],
  });
  assert.equal(pronostico.ventasEsperadas, 2000);
  assert.equal(pronostico.ganancia, 2000 * 0.4 - 500);
  assert.equal(pronostico.roasEquilibrio, 2.5);
  assert.equal(pronostico.historico.confianza, "baja");
  assert.ok(pronostico.supuestos.some((texto) => texto.includes("Pocas campañas")));
});

test("sin historial no inventa venta, pero sí dice el ROAS para no perder", () => {
  const pronostico = pronosticarCampana({ presupuesto: 500, margenBruto: 0.5, historial: [] });
  assert.equal(pronostico.estado, ESTADOS_IMPACTO.FALTAN_DATOS);
  assert.equal(pronostico.ganancia, null);
  assert.equal(pronostico.roasEquilibrio, 2);
});

test("solo usa campañas con venta y gasto confirmados", () => {
  const historial = historialCampanasConfirmadas([
    { producto: "Labial", resultado: { ventaAcumulada: 3000, gastoAcumulado: 1000, camposConfirmados: { venta: true, gasto: true } } },
    { producto: "Rímel", resultado: { ventaAcumulada: 9000, gastoAcumulado: 1000, camposConfirmados: { venta: true } } },
    { producto: "Base", resultado: { ventaAcumulada: 0, gastoAcumulado: 0, camposConfirmados: { venta: true, gasto: true } } },
  ]);
  assert.deepEqual(historial, [{ venta: 3000, gasto: 1000, nombre: "Labial" }]);
});
