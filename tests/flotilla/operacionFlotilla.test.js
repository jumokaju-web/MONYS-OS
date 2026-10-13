import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularRepartoRental,
  calcularPagoRuta,
  resumirOperacionFlotilla,
} from "../../src/features/flotilla/utils/operacionFlotilla.js";

test("conserva los tramos de pago MLP de Chory v18.5", () => {
  assert.deepEqual(
    [99, 100, 154, 155, 200, 201].map((km) => calcularPagoRuta(km).total),
    [1600, 1750, 1750, 1900, 1900, 2025]
  );
});

test("conserva pagos fijos de unidades rental", () => {
  assert.equal(calcularPagoRuta(300, "RENTAL_SMALL").total, 1100);
  assert.equal(calcularPagoRuta(20, "RENTAL_LARGE").total, 1221);
});

test("solo un adelanto entregado reduce el saldo del chofer", () => {
  const resumen = resumirOperacionFlotilla(
    { km_inicial: 1000, km_final: 1120, tipo_pago: "MLP" },
    [
      { tipo: "ADELANTO", estado: "SOLICITADO", importe: 500 },
      { tipo: "ADELANTO", estado: "ENTREGADO", importe: 300 },
      { tipo: "GASOLINA", estado: "CAPTURADO", importe: 700 },
    ]
  );

  assert.equal(resumen.ganado, 1750);
  assert.equal(resumen.adelantosSolicitados, 500);
  assert.equal(resumen.adelantosEntregados, 300);
  assert.equal(resumen.saldoEstimado, 1450);
  assert.equal(resumen.gasolina, 700);
});

test("ambulancia confirmada suma al chofer y gasolina queda separada", () => {
  const resumen = resumirOperacionFlotilla(
    { km_inicial: 1000, km_final: 1080, tipo_pago: "MLP" },
    [
      { tipo: "AMBULANCIA", estado: "CONFIRMADO", importe: 250 },
      { tipo: "AMBULANCIA", estado: "SOLICITADO", importe: 999 },
      { tipo: "GASOLINA", estado: "CAPTURADO", importe: 450 },
    ]
  );

  assert.equal(resumen.ganado, 1850);
  assert.equal(resumen.gasolina, 450);
  assert.equal(resumen.saldoEstimado, 1850);
});

test("usa los kilómetros calculados por la base aunque no haya lecturas inicial y final", () => {
  const resumen = resumirOperacionFlotilla(
    { kilometros_ruta: 201, tipo_pago: "MLP" },
    []
  );

  assert.equal(resumen.kilometros, 201);
  assert.equal(resumen.bonoKilometraje, 425);
  assert.equal(resumen.ganado, 2025);
});

test("la utilidad rental descuenta choferes, gasolina y un gasto manual", () => {
  const resumen = calcularRepartoRental([
    { tipo_pago: "RENTAL_SMALL", resumen: { ganado: 1100, gasolina: 350 } },
    { tipo_pago: "RENTAL_LARGE", resumen: { ganado: 1471, gasolina: 450 } },
    { tipo_pago: "MLP", resumen: { ganado: 2025, gasolina: 999 } },
  ], { ingreso: 7200, otro_concepto: "Taxi", otro_importe: 300 });

  assert.equal(resumen.pagoChoferes, 2571);
  assert.equal(resumen.gasolina, 800);
  assert.equal(resumen.utilidadNeta, 3529);
  assert.equal(resumen.partePorSocio, 1176.33);
  assert.deepEqual(resumen.socios, ["Abraham", "Chory", "Kary"]);
});

test("una pérdida rental se muestra pero no se reparte", () => {
  const resumen = calcularRepartoRental([
    { tipo_pago: "RENTAL_SMALL", resumen: { ganado: 1100, gasolina: 500 } },
  ], { ingreso: 1000, otro_importe: 200 });

  assert.equal(resumen.utilidadNeta, -800);
  assert.equal(resumen.utilidadRepartible, 0);
  assert.equal(resumen.partePorSocio, 0);
  assert.equal(resumen.hayPerdida, true);
});

test("reconoce una rental configurada desde la unidad", () => {
  const resumen = calcularRepartoRental([
    {
      tipo_pago: null,
      unidad: { tipo_pago_chory: "RENTAL_SMALL" },
      resumen: { ganado: 1100, gasolina: 200 },
    },
  ], { ingreso: 2000 });

  assert.equal(resumen.rutas, 1);
  assert.equal(resumen.utilidadNeta, 700);
});
