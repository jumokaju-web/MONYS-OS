import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularCorteCaja,
  calcularLiquidacionFlotilla,
  crearObservacionesCorte,
  crearObservacionesFlotilla,
  leerCorteCaja,
  leerLiquidacionFlotilla,
  crearObservacionesAperturaCaja,
  leerAperturaCaja,
  obtenerSesionCajaActiva,
  FONDO_FIJO_CAJA,
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
      entradasPosteriores: 0,
      salidasPosteriores: 450,
      traspasos: 0,
      prestamos: 0,
      movimientosRegistrados: 0,
    }
  );
});

test("separa movimientos detallados, traspasos y préstamos del corte", () => {
  assert.deepEqual(
    calcularCorteCaja({
      ventaSicar: 1000,
      efectivoVentas: 500,
      tarjeta: 500,
      fondoInicial: 100,
      efectivoFinal: 50,
      movimientosCaja: [
        { tipo: "salida", categoria: "proveedor", monto: 100 },
        { tipo: "salida", categoria: "deposito_traspaso", monto: 300 },
        { tipo: "salida", categoria: "prestamo_anticipo", monto: 200 },
        { tipo: "entrada", categoria: "otro", monto: 50 },
      ],
    }),
    {
      cobrado: 1000,
      diferenciaVenta: 0,
      efectivoEsperado: 50,
      diferenciaCaja: 0,
      entradasPosteriores: 50,
      salidasPosteriores: 600,
      traspasos: 300,
      prestamos: 200,
      movimientosRegistrados: 4,
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

test("abre caja con fondo fijo de mil pesos y conserva a la responsable", () => {
  const observaciones = crearObservacionesAperturaCaja({
    sesionCajaId: "caja-1",
    responsable: "Kary",
    fondoInicial: 250,
    abiertoEn: "2026-10-11T15:00:00.000Z",
  });
  const apertura = leerAperturaCaja(observaciones);
  assert.equal(apertura.fondoInicial, FONDO_FIJO_CAJA);
  assert.equal(apertura.responsable, "Kary");
});

test("la última apertura queda activa hasta que se registra un corte", () => {
  const apertura = {
    id: "a1",
    created_at: "2026-10-11T15:00:00.000Z",
    observaciones: crearObservacionesAperturaCaja({
      sesionCajaId: "caja-1",
      responsable: "Vale",
    }),
  };
  assert.equal(obtenerSesionCajaActiva([apertura]).responsable, "Vale");

  const cierre = {
    id: "c1",
    created_at: "2026-10-11T18:00:00.000Z",
    observaciones: crearObservacionesCorte({
      sesionCajaId: "caja-1",
      ventaSicar: 1000,
      fondoInicial: 1000,
      efectivoFinal: 1000,
    }),
  };
  assert.equal(obtenerSesionCajaActiva([apertura, cierre]), null);
});
