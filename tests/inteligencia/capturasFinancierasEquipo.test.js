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
  crearObservacionesCorreccionCierre,
  indexarCorreccionesCierres,
  extraerCapturasFinancieras,
  leerAperturaCaja,
  leerCorreccionCierre,
  obtenerSesionCajaActiva,
  obtenerSesionesCajaActivas,
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

test("mantiene Caja 1 y Caja 2 independientes y cada corte cierra solo su caja", () => {
  const apertura = (id, cajaId, responsable, hora) => ({ id, created_at: hora, observaciones: crearObservacionesAperturaCaja({ sesionCajaId: id, cajaId, cajaNombre: cajaId === 'CAJA_1' ? 'Caja 1' : 'Caja 2', responsable, abiertoEn: hora }) });
  const registros = [
    apertura('a1', 'CAJA_1', 'Vita', '2026-10-14T15:00:00.000Z'),
    apertura('a2', 'CAJA_2', 'Karla', '2026-10-14T15:05:00.000Z'),
  ];
  assert.equal(obtenerSesionCajaActiva(registros, 'CAJA_1').responsable, 'Vita');
  assert.equal(obtenerSesionCajaActiva(registros, 'CAJA_2').responsable, 'Karla');
  assert.equal(obtenerSesionCajaActiva(registros), null, 'no debe elegir una caja arbitrariamente cuando hay dos abiertas');
  registros.push({ id: 'c2', created_at: '2026-10-15T01:00:00.000Z', observaciones: crearObservacionesCorte({ cajaId: 'CAJA_2', sesionCajaId: 'a2', responsableApertura: 'Karla', responsableCierre: 'Karla' }) });
  const activas = obtenerSesionesCajaActivas(registros);
  assert.equal(activas.CAJA_1.responsable, 'Vita');
  assert.equal(activas.CAJA_2, undefined);
});

test("la corrección histórica conserva el original y usa la última en la vista", () => {
  const primera = { id: 'r1', created_at: '2026-10-15T03:00:00.000Z', observaciones: crearObservacionesCorreccionCierre({ cierreId: 'c1', responsableCorregido: 'Karla', cajaId: 'CAJA_1', cajaNombre: 'Caja 1', corregidoPor: 'Mónica' }) };
  const ultima = { id: 'r2', created_at: '2026-10-15T03:05:00.000Z', observaciones: crearObservacionesCorreccionCierre({ cierreId: 'c1', responsableCorregido: 'KARLA YOSELIN', cajaId: 'CAJA_1', cajaNombre: 'Caja 1', corregidoPor: 'Mónica' }) };
  assert.equal(leerCorreccionCierre(primera.observaciones).cierreId, 'c1');
  const indice = indexarCorreccionesCierres([ultima, primera]);
  assert.equal(indice.get('c1').responsableCorregido, 'KARLA YOSELIN');
  assert.equal(indice.get('c1').cajaNombre, 'Caja 1');
});

test("Finanzas conserva un cierre anterior corregido aunque no tenga bloque financiero", () => {
  const cierre = {
    id: 'c1',
    branch_id: 'centro',
    responsable: 'Vita',
    turno: 'cierre_caja',
    fecha: '2026-10-14',
    created_at: '2026-10-15T02:10:00.000Z',
    observaciones: 'Cierre enviado desde una versión anterior.',
  };
  const correccion = {
    id: 'r1',
    branch_id: 'centro',
    responsable: 'Mónica',
    turno: 'correccion_cierre',
    created_at: '2026-10-15T03:10:00.000Z',
    observaciones: crearObservacionesCorreccionCierre({
      cierreId: 'c1',
      responsableCorregido: 'KARLA YOSELIN',
      cajaId: 'CAJA_1',
      cajaNombre: 'Caja 1',
      corregidoPor: 'Mónica',
    }),
  };

  const capturas = extraerCapturasFinancieras([correccion, cierre]);
  assert.equal(capturas.length, 1);
  assert.equal(capturas[0].tipo, 'caja');
  assert.equal(capturas[0].cierre.responsable, 'KARLA YOSELIN');
  assert.equal(capturas[0].datos.cajaNombre, 'Caja 1');
  assert.equal(capturas[0].datos.responsableOriginal, 'Vita');
  assert.equal(capturas[0].datos.registroIncompleto, true);
  assert.equal(capturas[0].datos.diferenciaCaja, null);
});

test("Finanzas aplica la corrección sin perder los importes del corte nuevo", () => {
  const cierre = {
    id: 'c2',
    responsable: 'Vita',
    turno: 'cierre_caja',
    observaciones: crearObservacionesCorte({
      cajaId: 'CAJA_2',
      cajaNombre: 'Caja 2',
      ventaSicar: 1000,
      efectivoVentas: 1000,
      efectivoFinal: 2000,
      fondoInicial: 1000,
    }),
  };
  const correccion = {
    id: 'r2',
    responsable: 'Mónica',
    turno: 'correccion_cierre',
    created_at: '2026-10-15T03:20:00.000Z',
    observaciones: crearObservacionesCorreccionCierre({
      cierreId: 'c2',
      responsableCorregido: 'Karla Yoselin',
      cajaId: 'CAJA_1',
      cajaNombre: 'Caja 1',
      corregidoPor: 'Mónica',
    }),
  };

  const [captura] = extraerCapturasFinancieras([cierre, correccion]);
  assert.equal(captura.datos.ventaSicar, 1000);
  assert.equal(captura.datos.diferenciaCaja, 0);
  assert.equal(captura.datos.cajaNombre, 'Caja 1');
  assert.equal(captura.cierre.responsable, 'Karla Yoselin');
});

test("flujo completo: el cierre de Caja 1 llega a Finanzas con venta y efectivo disponibles", () => {
  const datos = {
    cajaId: "CAJA_1",
    cajaNombre: "Caja 1",
    responsableCierre: "Karla Yoselin",
    ventaSicar: 10000,
    efectivoVentas: 4000,
    tarjeta: 3500,
    transferencias: 2500,
    otrosCobros: 0,
    fondoInicial: 1000,
    efectivoEntregado: 4000,
    efectivoFinal: 1000,
    fotoCorteUrl: "https://evidencia.local/corte.jpg",
    movimientosCaja: [],
  };
  const cierre = {
    id: "cierre-prueba",
    branch_id: "centro",
    responsable: "Karla Yoselin",
    turno: "cierre_caja",
    fecha: "2026-10-15",
    observaciones: crearObservacionesCorte(datos),
  };

  const [captura] = extraerCapturasFinancieras([cierre]);
  assert.equal(captura.tipo, "caja");
  assert.equal(captura.datos.cajaNombre, "Caja 1");
  assert.equal(captura.datos.ventaSicar, 10000);
  assert.equal(captura.datos.cobrado, 10000);
  assert.equal(captura.datos.diferenciaVenta, 0);
  assert.equal(captura.datos.efectivoFinal, 1000);
  assert.equal(captura.datos.efectivoEsperado, 1000);
  assert.equal(captura.datos.diferenciaCaja, 0);
  assert.equal(captura.datos.fotoCorteUrl, "https://evidencia.local/corte.jpg");
});
