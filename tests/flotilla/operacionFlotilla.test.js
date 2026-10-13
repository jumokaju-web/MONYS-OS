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

test("separa cobro rental del pago fijo al chofer", () => {
  assert.deepEqual(calcularPagoRuta(300, "RENTAL_SMALL"), { base: 850, bono: 0, total: 850, cobroEmpresa: 1100 });
  assert.deepEqual(calcularPagoRuta(20, "RENTAL_LARGE"), { base: 1000, bono: 0, total: 1000, cobroEmpresa: 1221 });
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

test("la utilidad rental usa tarifas y solo descuenta gasolina pagada por la empresa", () => {
  const resumen = calcularRepartoRental([
    { tipo_pago: "RENTAL_SMALL", resumen: { ganado: 850, ingresoRental: 1100, gasolinaEmpresa: 0, gasolinaChofer: 350 } },
    { tipo_pago: "RENTAL_LARGE", resumen: { ganado: 1000, ingresoRental: 1221, gasolinaEmpresa: 100, gasolinaChofer: 450 } },
    { tipo_pago: "MLP", resumen: { ganado: 2025, gasolina: 999 } },
  ], { otro_concepto: "Taxi", otro_importe: 100 });

  assert.equal(resumen.ingreso, 2321);
  assert.equal(resumen.pagoChoferes, 1850);
  assert.equal(resumen.gasolinaEmpresa, 100);
  assert.equal(resumen.gasolinaChofer, 800);
  assert.equal(resumen.utilidadNeta, 271);
  assert.equal(resumen.partePorSocio, 90.33);
  assert.deepEqual(resumen.socios, ["Abraham", "Chory", "Kary"]);
});

test("una pérdida rental se muestra pero no se reparte", () => {
  const resumen = calcularRepartoRental([
    { tipo_pago: "RENTAL_SMALL", resumen: { ganado: 850, ingresoRental: 1100, gasolinaEmpresa: 500, gasolinaChofer: 0 } },
  ], { otro_importe: 200 });

  assert.equal(resumen.utilidadNeta, -450);
  assert.equal(resumen.utilidadRepartible, 0);
  assert.equal(resumen.partePorSocio, 0);
  assert.equal(resumen.hayPerdida, true);
});

test("reconoce una rental configurada desde la unidad", () => {
  const resumen = calcularRepartoRental([
    {
      tipo_pago: null,
      unidad: { tipo_pago_chory: "RENTAL_SMALL" },
      resumen: { ganado: 850, ingresoRental: 1100, gasolinaEmpresa: 0, gasolinaChofer: 200 },
    },
  ], {});

  assert.equal(resumen.rutas, 1);
  assert.equal(resumen.utilidadNeta, 250);
});

test("un cobro confirmado sustituye el ingreso automático de tarifas", () => {
  const resumen = calcularRepartoRental([
    { tipo_pago: "RENTAL_LARGE", resumen: { ganado: 1000, ingresoRental: 1221 } },
  ], { ingreso: 1300 });
  assert.equal(resumen.ingreso, 1300);
  assert.equal(resumen.origenIngreso, "REGISTRADO");
  assert.equal(resumen.utilidadNeta, 300);
});
