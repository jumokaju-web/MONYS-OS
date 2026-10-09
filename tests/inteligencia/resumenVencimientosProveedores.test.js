import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularResumenVencimientosProveedores,
  obtenerFechaHoyMexico,
} from "../../src/features/inteligencia/shared/resumenVencimientosProveedores.js";

test("calcula vencimientos acumulados y separa saldos vencidos", () => {
  const resumen = calcularResumenVencimientosProveedores(
    [
      { saldo: 1000, fecha_vencimiento: "2026-10-01" },
      { saldo: 200, fecha_vencimiento: "2026-10-14" },
      { saldo: 300, fecha_vencimiento: "2026-10-15" },
      { saldo: 400, fecha_vencimiento: "2026-11-06" },
      { saldo: 500, fecha_vencimiento: "2026-11-07" },
      { saldo: 600, fecha_vencimiento: null },
      { saldo: 700, fecha_vencimiento: "fecha inválida" },
      { saldo: 0, fecha_vencimiento: "2026-10-08" },
      { saldo: -50, fecha_vencimiento: "2026-10-08" },
    ],
    "2026-10-07",
  );

  assert.deepEqual(resumen, {
    saldoVencido: 1000,
    cantidadVencidos: 1,
    vencimientos7Dias: 1200,
    vencimientos15Dias: 1500,
    vencimientos30Dias: 1900,
    vencimientos60Dias: 2400,
    vencimientos90Dias: 2400,
    saldoSinFecha: 1300,
    cantidadSinFecha: 2,
  });
});

test("no incluye fechas posteriores al horizonte", () => {
  const resumen = calcularResumenVencimientosProveedores(
    [{ saldo: 850, fecha_vencimiento: "2027-02-01" }],
    "2026-10-07",
  );

  assert.equal(resumen.vencimientos90Dias, 0);
  assert.equal(resumen.saldoVencido, 0);
  assert.equal(resumen.saldoSinFecha, 0);
});

test("usa la fecha civil de Ciudad de México, incluso antes de medianoche UTC", () => {
  assert.equal(
    obtenerFechaHoyMexico(new Date("2026-10-08T03:00:00.000Z")),
    "2026-10-07",
  );
});

test("maneja colecciones vacías", () => {
  assert.deepEqual(
    calcularResumenVencimientosProveedores([], "2026-10-07"),
    {
      saldoVencido: 0,
      cantidadVencidos: 0,
      vencimientos7Dias: 0,
      vencimientos15Dias: 0,
      vencimientos30Dias: 0,
      vencimientos60Dias: 0,
      vencimientos90Dias: 0,
      saldoSinFecha: 0,
      cantidadSinFecha: 0,
    },
  );
});
