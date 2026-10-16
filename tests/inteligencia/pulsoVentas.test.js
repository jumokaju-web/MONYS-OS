import test from "node:test";
import assert from "node:assert/strict";
import {
  crearResultadoPulsoVentas,
  leerResultadoPulsoVentas,
  resumirEstadoPulsos,
  validarValoresPulsoVentas,
} from "../../src/features/inteligencia/shared/pulsoVentas.js";

test("el pulso estructurado conserva ceros confirmados y señala su fuente", () => {
  const resultado = crearResultadoPulsoVentas({ personas: "0", ventas: "0", importe: "0" });
  assert.match(resultado, /MONYS_PULSO_VENTAS_V1/);
  assert.deepEqual(lees(resultado), {
    version: 1,
    fuente: "reporte_operativo_empleada",
    personasAtendidas: 0,
    ticketsOPedidos: 0,
    importeReportado: 0,
    observaciones: null,
  });
});

test("no interpreta campos ausentes ni texto dañado como ceros", () => {
  assert.equal(leerResultadoPulsoVentas(""), null);
  assert.equal(leerResultadoPulsoVentas("Personas atendidas: 0"), null);
  assert.equal(leerResultadoPulsoVentas("[MONYS_PULSO_VENTAS_V1]{"), null);
});

test("exige capturas explícitas y cuentas enteras para personas y tickets", () => {
  assert.equal(validarValoresPulsoVentas({ personas: "", ventas: "0", importe: "0" }), false);
  assert.equal(validarValoresPulsoVentas({ personas: "1.5", ventas: "1", importe: "10" }), false);
  assert.equal(validarValoresPulsoVentas({ personas: "2", ventas: "1", importe: "" }), false);
  assert.equal(validarValoresPulsoVentas({ personas: "0", ventas: "0", importe: "0" }), true);
});

test("lee resultados anteriores sin confundirlos con reportes SICAR", () => {
  const texto = "Personas atendidas o contactadas: 8\nVentas o pedidos logrados: 3\nImporte vendido o atribuido: $1,200.50\nProductos solicitados, faltantes u observaciones: base tono 2";
  assert.deepEqual(leerResultadoPulsoVentas(texto), {
    version: 0,
    fuente: "reporte_operativo_empleada",
    personasAtendidas: 8,
    ticketsOPedidos: 3,
    importeReportado: 1200.5,
    observaciones: "base tono 2",
  });
});

test("resume solamente pulsos terminados y completos; sin reportes mantiene pendiente", () => {
  const empleados = [{ nombre: "Ana", auth_user_id: "auth-1" }, { nombre: "Luz", auth_user_id: "auth-2" }];
  const resultado = crearResultadoPulsoVentas({ personas: 5, ventas: 2, importe: 400 });
  const resumen = resumirEstadoPulsos({ empleados, tareas: [
    { titulo: "PULSO DE VENTAS: 2026-10-16", responsable_usuario_id: "auth-1", estado: "terminada", resultado },
    { titulo: "PULSO DE VENTAS: 2026-10-16", responsable_usuario_id: "auth-2", estado: "pendiente", resultado: null },
  ] });
  assert.equal(resumen.reportesRecibidos, 1);
  assert.equal(resumen.ventasReportadas, 400);
  assert.equal(resumen.personasAtendidas, 5);
  assert.equal(resumen.filas[1].reporte, null);
  const vacio = resumirEstadoPulsos({ empleados, tareas: [] });
  assert.equal(vacio.ventasReportadas, null);
});

test("atribuye el reporte por identidad y no a otra empleada con el mismo nombre", () => {
  const empleados = [
    { nombre: "Ana", auth_user_id: "auth-ana-1" },
    { nombre: "Ana", auth_user_id: "auth-ana-2" },
  ];
  const resultado = crearResultadoPulsoVentas({ personas: 4, ventas: 1, importe: 250 });
  const resumen = resumirEstadoPulsos({ empleados, tareas: [
    { titulo: "PULSO DE VENTAS: 2026-10-16", responsable: "Ana", responsable_usuario_id: "auth-ana-2", estado: "terminada", resultado },
  ] });
  assert.equal(resumen.filas[0].reporte, null);
  assert.equal(resumen.filas[1].reporte.importeReportado, 250);
});

function lees(resultado) {
  return leerResultadoPulsoVentas(resultado);
}
