import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularAmbulancia,
  calcularRepartoRental,
  calcularPagoRuta,
  revisarEvidenciaRuta,
  resumirOperacionFlotilla,
} from "../../src/features/flotilla/utils/operacionFlotilla.js";

test("aplica los tramos de kilometraje confirmados para MLP", () => {
  assert.deepEqual(
    [100, 101, 150, 151, 200, 201, 250, 251].map((km) => calcularPagoRuta(km).total),
    [1600, 1750, 1750, 1900, 1900, 2025, 2025, 2100]
  );
});

test("calcula ambulancia por paradas y usa media ruta desde 31", () => {
  assert.deepEqual(
    [0, 1, 15, 16, 30, 31].map((paradas) => calcularAmbulancia(paradas, 1600)),
    [0, 200, 200, 320, 320, 800]
  );
  assert.equal(calcularAmbulancia(31, 1000), 500);
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

test("ambulancia confirmada se descuenta al chofer apoyado", () => {
  const resumen = resumirOperacionFlotilla(
    { km_inicial: 1000, km_final: 1080, tipo_pago: "MLP" },
    [{ tipo: "AMBULANCIA_DESCUENTO", estado: "CONFIRMADO", importe: 200 }]
  );

  assert.equal(resumen.ambulanciasDescontadas, 200);
  assert.equal(resumen.ganado, 1400);
  assert.equal(resumen.saldoEstimado, 1400);
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
    { tipo_pago: "RENTAL_SMALL", resumen: { pagoBase: 850, ganado: 650, ingresoRental: 1100, gasolinaEmpresa: 0, gasolinaChofer: 350, ambulanciasDescontadas: 200 } },
    { tipo_pago: "RENTAL_LARGE", resumen: { pagoBase: 1000, ganado: 1320, ingresoRental: 1221, gasolinaEmpresa: 100, gasolinaChofer: 450, ambulanciasConfirmadas: 320 } },
    { tipo_pago: "MLP", resumen: { ganado: 2025, gasolina: 999 } },
  ], { otro_concepto: "Taxi", otro_importe: 100 });

  assert.equal(resumen.ingreso, 2321);
  assert.equal(resumen.pagoChoferes, 1850);
  assert.equal(resumen.gasolinaEmpresa, 100);
  assert.equal(resumen.gasolinaChofer, 800);
  assert.equal(resumen.utilidadNeta, 271);
  assert.equal(resumen.partePorSocio, 90.33);
  assert.deepEqual(resumen.repartoSocios, { Abraham: 90.33, Chory: 90.33, Kary: 90.34 });
  assert.equal(Object.values(resumen.repartoSocios).reduce((total, parte) => total + parte, 0), resumen.utilidadRepartible);
  assert.deepEqual(resumen.socios, ["Abraham", "Chory", "Kary"]);
});

test("una pérdida rental se muestra pero no se reparte", () => {
  const resumen = calcularRepartoRental([
    { tipo_pago: "RENTAL_SMALL", resumen: { pagoBase: 850, ganado: 850, ingresoRental: 1100, gasolinaEmpresa: 500, gasolinaChofer: 0 } },
  ], { otro_importe: 200 });

  assert.equal(resumen.utilidadNeta, -450);
  assert.equal(resumen.utilidadRepartible, 0);
  assert.equal(resumen.partePorSocio, 0);
  assert.deepEqual(resumen.repartoSocios, { Abraham: 0, Chory: 0, Kary: 0 });
  assert.equal(resumen.hayPerdida, true);
});

test("reconoce una rental configurada desde la unidad", () => {
  const resumen = calcularRepartoRental([
    {
      tipo_pago: null,
      unidad: { tipo_pago_chory: "RENTAL_SMALL" },
      resumen: { pagoBase: 850, ganado: 850, ingresoRental: 1100, gasolinaEmpresa: 0, gasolinaChofer: 200 },
    },
  ], {});

  assert.equal(resumen.rutas, 1);
  assert.equal(resumen.utilidadNeta, 250);
});

test("un cobro confirmado sustituye el ingreso automático de tarifas", () => {
  const resumen = calcularRepartoRental([
    { tipo_pago: "RENTAL_LARGE", resumen: { pagoBase: 1000, ganado: 1000, ingresoRental: 1221 } },
  ], { ingreso: 1300 });
  assert.equal(resumen.ingreso, 1300);
  assert.equal(resumen.origenIngreso, "REGISTRADO");
  assert.equal(resumen.utilidadNeta, 300);
});

test("marca una ruta activa completa como evidencia en curso", () => {
  const revision = revisarEvidenciaRuta({
    estado: "EN_RUTA",
    km_inicial: 1000,
    gasolina_in: "1/2",
    foto_salida_path: "chofer/ruta/salida.jpg",
  });

  assert.equal(revision.estado, "EN_CURSO");
  assert.deepEqual(revision.faltantes, []);
});

test("detecta datos y fotos faltantes al cerrar una ruta", () => {
  const revision = revisarEvidenciaRuta({
    estado: "FINALIZADA",
    km_inicial: 1000,
    gasolina_in: "1/2",
    foto_salida_url: "https://evidencia/salida",
  });

  assert.equal(revision.estado, "PENDIENTE");
  assert.deepEqual(revision.faltantes, [
    "Kilometraje final válido",
    "Gasolina final",
    "Foto del tablero al regresar",
  ]);
});

test("revisa el ticket y los datos de cada carga de gasolina", () => {
  const revision = revisarEvidenciaRuta({
    estado: "EN_RUTA",
    km_inicial: 1000,
    gasolina_in: "1/2",
    foto_salida_path: "salida.jpg",
  }, [{ tipo: "GASOLINA", estado: "CAPTURADO", importe: 500, litros: 0, pagador: "", evidencia_url: null }]);

  assert.deepEqual(revision.faltantes, [
    "Carga de gasolina 1: litros",
    "Carga de gasolina 1: quién pagó",
    "Carga de gasolina 1: foto del ticket",
  ]);
});

test("una ruta finalizada con evidencias completas queda lista para revisión", () => {
  const revision = revisarEvidenciaRuta({
    estado: "FINALIZADA",
    km_inicial: 1000,
    km_final: 1120,
    gasolina_in: "1/2",
    gasolina_out: "1/4",
    foto_salida_url: "https://evidencia/salida",
    foto_cierre_url: "https://evidencia/cierre",
  }, [{ tipo: "GASOLINA", estado: "CAPTURADO", importe: 500, litros: 20, pagador: "CHOFER", evidencia_url: "https://evidencia/ticket" }]);

  assert.equal(revision.estado, "COMPLETA");
  assert.equal(revision.totalFaltantes, 0);
});
