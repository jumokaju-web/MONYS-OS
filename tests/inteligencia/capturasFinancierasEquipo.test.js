import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularCorteCaja,
  calcularLiquidacionFlotilla,
  crearObservacionesCorte,
  crearObservacionesFlotilla,
  leerCorteCaja,
  leerLiquidacionFlotilla,
} from "../../src/features/inteligencia/utils/capturasFinancierasEquipo.js";

test("calcula conciliación de venta y efectivo del corte", () => {
  assert.deepEqual(
    calcularCorteCaja({
      ventaSicar: 1000,
      efectivoVentas: 500,
      tarjeta: 300,
      transferencias: 200,
      fondoInicial: 100,
      gastosCaja: 50,
      efectivoEntregado: 400,
      efectivoFinal: 150,
    }),
    {
      cobrado: 1000,
      diferenciaVenta: 0,
      efectivoEsperado: 150,
      diferenciaCaja: 0,
    }
  );
});

test("conserva y recupera el bloque de caja dentro de observaciones", () => {
  const texto = crearObservacionesCorte({ ventaSicar: 1200 }, "Todo bien");
  assert.equal(leerCorteCaja(texto).ventaSicar, 1200);
  assert.match(texto, /NOTA_EQUIPO: Todo bien/);
});

test("calcula y recupera la liquidación de flotilla", () => {
  const datos = { ingresoRuta: 2000, pagoChofer: 600, gasolina: 350, casetas: 50 };
  assert.deepEqual(calcularLiquidacionFlotilla(datos), {
    gastos: 1000,
    resultadoEstimado: 1000,
  });
  assert.equal(
    leerLiquidacionFlotilla(crearObservacionesFlotilla(datos)).resultadoEstimado,
    1000
  );
});
