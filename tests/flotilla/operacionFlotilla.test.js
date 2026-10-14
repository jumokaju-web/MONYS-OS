import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularAmbulancia,
  calcularRepartoRental,
  calcularResumenRentalPeriodo,
  calcularPagoRuta,
  crearFilasReporteRental,
  crearFilasPrefacturaFlotilla,
  crearPrefacturaFlotilla,
  evaluarGasolina,
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

test("un adelanto entregado y la gasolina sin evidencias reducen el saldo del chofer", () => {
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
  assert.equal(resumen.saldoEstimado, 750);
  assert.equal(resumen.gasolina, 0);
  assert.equal(resumen.prestamosGasolina, 700);
});

test("ambulancia confirmada suma y gasolina sin evidencia se vuelve préstamo", () => {
  const resumen = resumirOperacionFlotilla(
    { km_inicial: 1000, km_final: 1080, tipo_pago: "MLP" },
    [
      { tipo: "AMBULANCIA", estado: "CONFIRMADO", importe: 250 },
      { tipo: "AMBULANCIA", estado: "SOLICITADO", importe: 999 },
      { tipo: "GASOLINA", estado: "CAPTURADO", importe: 450 },
    ]
  );

  assert.equal(resumen.ganado, 1850);
  assert.equal(resumen.gasolina, 0);
  assert.equal(resumen.prestamosGasolina, 450);
  assert.equal(resumen.saldoEstimado, 1400);
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
  assert.equal(resumen.pagoChoferes, 1970);
  assert.equal(resumen.gasolinaEmpresa, 100);
  assert.equal(resumen.gasolinaChofer, 800);
  assert.equal(resumen.utilidadNeta, 151);
  assert.equal(resumen.partePorSocio, 50.33);
  assert.deepEqual(resumen.repartoSocios, { Abraham: 50.33, Chory: 50.33, Kary: 50.34 });
  assert.equal(Object.values(resumen.repartoSocios).reduce((total, parte) => total + parte, 0), resumen.utilidadRepartible);
  assert.deepEqual(resumen.socios, ["Abraham", "Chory", "Kary"]);
  assert.equal(resumen.detalleRutas[0].utilidadRuta, 450);
  assert.equal(resumen.detalleRutas[1].utilidadRuta, -199);
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

test("los adelantos reducen el saldo pendiente pero no vuelven a reducir la utilidad rental", () => {
  const resumen = calcularRepartoRental([{
    id: "rental-1",
    codigo_ruta: "R-10",
    chofer_nombre: "Luis",
    tipo_pago: "RENTAL_SMALL",
    unidad: { placas: "LG-44-598" },
    resumen: {
      ingresoRental: 1100,
      ganado: 650,
      adelantosEntregados: 300,
      gasolinaEmpresa: 0,
      gasolinaChofer: 250,
      ambulanciasDescontadas: 200,
    },
  }], {});

  assert.equal(resumen.pagoChoferes, 650);
  assert.equal(resumen.adelantosEntregados, 300);
  assert.equal(resumen.saldoChoferes, 350);
  assert.equal(resumen.utilidadNeta, 450);
  assert.deepEqual(resumen.detalleRutas[0], {
    id: "rental-1",
    tipo: "RENTAL_SMALL",
    etiquetaTipo: "Small",
    chofer: "Luis",
    placas: "LG-44-598",
    codigoRuta: "R-10",
    ingreso: 1100,
    pagoChofer: 650,
    adelantos: 300,
    saldoChofer: 350,
    gasolinaEmpresa: 0,
    gasolinaChofer: 250,
    ambulanciasFavor: 0,
    ambulanciasDescuento: 200,
    utilidadRuta: 450,
  });
});

test("el corte por periodo separa saldos por pagar de adelantos excedentes", () => {
  const resumen = calcularResumenRentalPeriodo([
    {
      id: "small-1", fecha: "2026-10-12", chofer_nombre: "Luis", tipo_pago: "RENTAL_SMALL",
      unidad: { placas: "LG-44-598" },
      resumen: { ingresoRental: 1100, ganado: 650, adelantosEntregados: 300, gasolinaEmpresa: 0, gasolinaChofer: 250, ambulanciasDescontadas: 200 },
    },
    {
      id: "small-2", fecha: "2026-10-13", chofer_nombre: "Luis", tipo_pago: "RENTAL_SMALL",
      unidad: { placas: "LG-44-598" },
      resumen: { ingresoRental: 1100, ganado: 1050, adelantosEntregados: 900, gasolinaEmpresa: 0, gasolinaChofer: 300, ambulanciasConfirmadas: 200 },
    },
    {
      id: "large-1", fecha: "2026-10-13", chofer_nombre: "Ricardo", tipo_pago: "RENTAL_LARGE",
      unidad: { placas: "LG-67-379" },
      resumen: { ingresoRental: 1221, ganado: 1000, adelantosEntregados: 1200, gasolinaEmpresa: 100, gasolinaChofer: 0 },
    },
  ], [{ fecha: "2026-10-13", otro_concepto: "Taxi", otro_importe: 100 }]);

  assert.equal(resumen.rutas, 3);
  assert.equal(resumen.rutasSmall, 2);
  assert.equal(resumen.rutasLarge, 1);
  assert.equal(resumen.ingreso, 3421);
  assert.equal(resumen.pagoChoferes, 2700);
  assert.equal(resumen.adelantosEntregados, 2400);
  assert.equal(resumen.saldoChoferes, 300);
  assert.equal(resumen.saldoPorPagar, 500);
  assert.equal(resumen.adelantoExcedente, 200);
  assert.equal(resumen.utilidadNeta, 521);
  assert.deepEqual(resumen.repartoSocios, { Abraham: 173.66, Chory: 173.66, Kary: 173.68 });
  assert.deepEqual(resumen.choferes.map((item) => [item.chofer, item.estado, item.saldoPorPagar, item.adelantoExcedente]), [
    ["Luis", "PENDIENTE", 500, 0],
    ["Ricardo", "ADELANTO_MAYOR", 0, 200],
  ]);
});

test("el corte por periodo compensa una pérdida antes de repartir utilidad", () => {
  const resumen = calcularResumenRentalPeriodo([
    { fecha: "2026-10-12", tipo_pago: "RENTAL_SMALL", resumen: { ingresoRental: 1100, ganado: 850, gasolinaEmpresa: 0 } },
    { fecha: "2026-10-13", tipo_pago: "RENTAL_SMALL", resumen: { ingresoRental: 1100, ganado: 850, gasolinaEmpresa: 500 } },
  ], []);

  assert.equal(resumen.utilidadNeta, 0);
  assert.deepEqual(resumen.repartoSocios, { Abraham: 0, Chory: 0, Kary: 0 });
});

test("una liquidación exacta deja de aparecer como pendiente", () => {
  const operaciones = [{
    fecha: "2026-10-13", chofer_nombre: "Luis", tipo_pago: "RENTAL_SMALL",
    unidad: { placas: "LG-44-598" },
    resumen: { ingresoRental: 1100, ganado: 850, adelantosEntregados: 300 },
  }];
  const liquidaciones = [{
    id: "liq-1", estado: "PAGADA", chofer_nombre: "Luis", placas: "LG-44-598",
    ganado_calculado: 850, adelantos_entregados: 300, monto_pagado: 550,
    adelanto_excedente: 0, pagado_en: "2026-10-13T22:00:00Z",
  }];
  const resumen = calcularResumenRentalPeriodo(operaciones, [], liquidaciones);

  assert.equal(resumen.choferes[0].estado, "PAGADO");
  assert.equal(resumen.choferes[0].montoLiquidado, 550);
  assert.equal(resumen.pendienteLiquidar, 0);
  assert.equal(resumen.pagadoLiquidaciones, 550);
  assert.equal(resumen.pagosPorRevisar, 0);
});

test("si cambia la cuenta después del pago exige revisar la liquidación", () => {
  const operaciones = [{
    fecha: "2026-10-13", chofer_nombre: "Luis", tipo_pago: "RENTAL_SMALL",
    unidad: { placas: "LG-44-598" },
    resumen: { ingresoRental: 1100, ganado: 1050, adelantosEntregados: 300, ambulanciasConfirmadas: 200 },
  }];
  const liquidaciones = [{
    id: "liq-1", estado: "PAGADA", chofer_nombre: "Luis", placas: "LG-44-598",
    ganado_calculado: 850, adelantos_entregados: 300, monto_pagado: 550,
    adelanto_excedente: 0,
  }];
  const resumen = calcularResumenRentalPeriodo(operaciones, [], liquidaciones);

  assert.equal(resumen.choferes[0].estado, "CAMBIO_POSTERIOR");
  assert.equal(resumen.pendienteLiquidar, 750);
  assert.equal(resumen.pagadoLiquidaciones, 0);
  assert.equal(resumen.pagosPorRevisar, 550);
});

test("registra el reparto exacto a Abraham, Chory y Kary sin perder centavos", () => {
  const operaciones = [{
    fecha: "2026-10-13", chofer_nombre: "Luis", tipo_pago: "RENTAL_SMALL",
    unidad: { placas: "LG-44-598" },
    resumen: { ingresoRental: 1100, ganado: 850 },
  }];
  const repartos = [
    { id: "r1", socio: "Abraham", estado: "PAGADO", utilidad_calculada: 250, parte_calculada: 83.33, monto_entregado: 83.33, pagado_en: "2026-10-13T22:00:00Z" },
    { id: "r2", socio: "Chory", estado: "PAGADO", utilidad_calculada: 250, parte_calculada: 83.33, monto_entregado: 83.33 },
    { id: "r3", socio: "Kary", estado: "PAGADO", utilidad_calculada: 250, parte_calculada: 83.34, monto_entregado: 83.34 },
  ];
  const resumen = calcularResumenRentalPeriodo(operaciones, [], [], repartos);

  assert.deepEqual(resumen.sociosDetalle.map((item) => [item.socio, item.calculado, item.estado]), [
    ["Abraham", 83.33, "PAGADO"],
    ["Chory", 83.33, "PAGADO"],
    ["Kary", 83.34, "PAGADO"],
  ]);
  assert.equal(resumen.repartoEntregado, 250);
  assert.equal(resumen.repartoPendiente, 0);
});

test("ignora repartos anulados y marca entregas antiguas cuando cambia la utilidad", () => {
  const operaciones = [{
    fecha: "2026-10-13", chofer_nombre: "Luis", tipo_pago: "RENTAL_SMALL",
    unidad: { placas: "LG-44-598" },
    resumen: { ingresoRental: 1100, ganado: 650, ambulanciasDescontadas: 200 },
  }];
  const repartos = [
    { id: "anulado", socio: "Abraham", estado: "ANULADO", utilidad_calculada: 250, parte_calculada: 83.33, monto_entregado: 83.33 },
    { id: "cambio", socio: "Chory", estado: "PAGADO", utilidad_calculada: 250, parte_calculada: 83.33, monto_entregado: 83.33 },
  ];
  const resumen = calcularResumenRentalPeriodo(operaciones, [], [], repartos);

  assert.equal(resumen.utilidadNeta, 450);
  assert.equal(resumen.sociosDetalle.find((item) => item.socio === "Abraham").estado, "PENDIENTE");
  assert.equal(resumen.sociosDetalle.find((item) => item.socio === "Chory").estado, "CAMBIO_POSTERIOR");
  assert.equal(resumen.repartoPorRevisar, 83.33);
});

test("prepara las cuatro hojas del reporte rental", () => {
  const resumen = calcularResumenRentalPeriodo([{
    fecha: "2026-10-13", chofer_nombre: "Luis", tipo_pago: "RENTAL_SMALL",
    unidad: { placas: "LG-44-598" },
    resumen: { ingresoRental: 1100, ganado: 850, gasolinaChofer: 300 },
  }]);
  const filas = crearFilasReporteRental({ desde: "2026-10-13", hasta: "2026-10-13", resumen });

  assert.equal(filas.corte[0]["Utilidad neta"], 250);
  assert.equal(filas.choferes[0].Chofer, "Luis");
  assert.equal(filas.socios.length, 3);
  assert.equal(filas.dias[0].Fecha, "2026-10-13");
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
    "Carga de gasolina 1: foto del tablero antes",
    "Carga de gasolina 1: foto del tablero después",
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
  }, [{
    tipo: "GASOLINA",
    estado: "CAPTURADO",
    importe: 500,
    litros: 20,
    pagador: "CHOFER",
    evidencia_ticket_url: "https://evidencia/ticket",
    evidencia_tablero_antes_url: "https://evidencia/antes",
    evidencia_tablero_despues_url: "https://evidencia/despues",
    revision_ticket: { estado: "APROBADA" },
    revision_tablero_antes: { estado: "APROBADA" },
    revision_tablero_despues: { estado: "APROBADA" },
  }]);

  assert.equal(revision.estado, "COMPLETA");
  assert.equal(revision.totalFaltantes, 0);
});

test("una foto de salida rechazada mantiene la ruta pendiente y muestra el motivo", () => {
  const revision = revisarEvidenciaRuta({
    estado: "EN_RUTA",
    km_inicial: 1000,
    gasolina_in: "1/2",
    foto_salida_url: "https://evidencia/salida",
    revision_foto_salida: { estado: "RECHAZADA", motivo: "Foto borrosa" },
  });

  assert.equal(revision.estado, "PENDIENTE");
  assert.deepEqual(revision.faltantes, ["Foto del tablero al salir rechazada: Foto borrosa"]);
});

test("un ticket rechazado mantiene pendiente la evidencia de gasolina", () => {
  const revision = revisarEvidenciaRuta({
    estado: "EN_RUTA",
    km_inicial: 1000,
    gasolina_in: "1/2",
    foto_salida_path: "salida.jpg",
  }, [{
    tipo: "GASOLINA",
    estado: "CAPTURADO",
    importe: 500,
    litros: 20,
    pagador: "CHOFER",
    evidencia_path: "ticket.jpg",
    revision_evidencia: { estado: "RECHAZADA", motivo: "Ticket incompleto o ilegible" },
  }]);

  assert.equal(revision.estado, "PENDIENTE");
  assert.deepEqual(revision.faltantes, [
    "Carga de gasolina 1: ticket rechazado: Ticket incompleto o ilegible",
    "Carga de gasolina 1: foto del tablero antes",
    "Carga de gasolina 1: foto del tablero después",
  ]);
});

test("gasolina exige ticket y tableros aprobados; de lo contrario es préstamo personal", () => {
  const incompleta = evaluarGasolina({
    evidencia_ticket_path: "ticket.jpg",
    revision_ticket: { estado: "APROBADA" },
  });
  assert.equal(incompleta.tratamiento, "PRESTAMO_PERSONAL");
  assert.deepEqual(incompleta.faltantes, ["foto del tablero antes", "foto del tablero después"]);

  const completa = evaluarGasolina({
    evidencia_ticket_path: "ticket.jpg",
    evidencia_tablero_antes_path: "antes.jpg",
    evidencia_tablero_despues_path: "despues.jpg",
    revision_ticket: { estado: "APROBADA" },
    revision_tablero_antes: { estado: "APROBADA" },
    revision_tablero_despues: { estado: "APROBADA" },
  });
  assert.equal(completa.tratamiento, "GASOLINA");
  assert.deepEqual(completa.faltantes, []);

  assert.equal(evaluarGasolina({ clasificacion_gasolina: "GASOLINA_APROBADA" }).aprobada, true);
});

test("la prefactura separa gasolina aprobada y préstamo por evidencia incompleta", () => {
  const prefactura = crearPrefacturaFlotilla([{
    id: "ruta-1",
    fecha: "2026-10-13",
    codigo_ruta: "R-100",
    chofer_nombre: "Javier",
    tipo_pago: "MLP",
    estado: "FINALIZADA",
    km_inicial: 1000,
    km_final: 1151,
    gasolina_in: "1/2",
    gasolina_out: "1/4",
    foto_salida_path: "salida.jpg",
    foto_cierre_path: "cierre.jpg",
    unidad: { placas: "HU1812B" },
    movimientos: [
      { tipo: "GASOLINA", estado: "CAPTURADO", importe: 500 },
      { tipo: "AMBULANCIA", estado: "CONFIRMADO", importe: 200 },
    ],
  }], { desde: "2026-10-13", hasta: "2026-10-13" });

  assert.equal(prefactura.totales.rutas, 1);
  assert.equal(prefactura.totales.importePrefactura, 2100);
  assert.equal(prefactura.totales.gasolinaAprobada, 0);
  assert.equal(prefactura.totales.prestamosGasolina, 500);
  assert.equal(prefactura.totales.saldoChoferes, 1600);
  assert.equal(crearFilasPrefacturaFlotilla(prefactura)[0]["Préstamo por gasolina"], 500);
});

test("una foto aprobada no genera faltantes adicionales", () => {
  const revision = revisarEvidenciaRuta({
    estado: "EN_RUTA",
    km_inicial: 1000,
    gasolina_in: "1/2",
    foto_salida_path: "salida.jpg",
    revision_foto_salida: { estado: "APROBADA", motivo: null },
  });

  assert.equal(revision.estado, "EN_CURSO");
  assert.deepEqual(revision.faltantes, []);
});
