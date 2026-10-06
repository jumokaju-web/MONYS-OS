import assert from "node:assert/strict";
import test from "node:test";
import { resumirResultadosCampanas } from "../../src/features/inteligencia/shared/resumenResultadosGrowth.js";

test("no suma utilidad si venta o gasto no están confirmados", () => {
  const resumen = resumirResultadosCampanas([
    { resultado: { utilidadEstimadaCampana: 350 } },
    {
      resultado: {
        ventaAcumulada: 1000,
        gastoAcumulado: 100,
        utilidadEstimadaCampana: 300,
        camposConfirmados: { venta: true },
      },
    },
  ]);

  assert.equal(resumen.utilidad, 0);
  assert.equal(resumen.campanasConUtilidad, 0);
});

test("suma utilidad estimada solo con venta y gasto confirmados, incluidos ceros", () => {
  const resumen = resumirResultadosCampanas([
    {
      estado: "ACTIVA",
      producto: "Base",
      resultado: {
        ventaAcumulada: 1000,
        gastoAcumulado: 100,
        utilidadEstimadaCampana: 300,
        camposConfirmados: { venta: true, gasto: true },
      },
    },
    {
      estado: "PREPARANDO",
      resultado: {
        ventaAcumulada: 0,
        gastoAcumulado: 0,
        utilidadEstimadaCampana: 0,
        camposConfirmados: { venta: true, gasto: true },
      },
    },
  ]);

  assert.equal(resumen.activas, 2);
  assert.equal(resumen.ventas, 1000);
  assert.equal(resumen.campanasConVentas, 2);
  assert.equal(resumen.inversion, 100);
  assert.equal(resumen.campanasConInversion, 2);
  assert.equal(resumen.utilidad, 300);
  assert.equal(resumen.campanasConUtilidad, 2);
});
