import test from "node:test";
import assert from "node:assert/strict";
import { resumirComisionesSicar } from "../../src/features/inteligencia/shared/resumenComisionesSicar.js";

const empleados = [
  { id: "1", nombre: "Karla", usuario_sicar: "KARLA" },
  { id: "2", nombre: "Kary", usuario_sicar: "kary jimenez" },
];

test("calcula 1% por empleada solo con usuario SICAR asignado y folio único", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05",
    hasta: "2026-10-11",
    empleados,
    filas: [
      { datos_originales: { fecha: "2026-10-05", folio: "A-1", usuario: "Karla", ventaTotal: 10000 } },
      { datos_originales: { fecha: "2026-10-05", folio: "A-1", usuario: "Karla", ventaTotal: 10000 } },
      { datos_originales: { fecha: "2026-10-06", folio: "A-2", usuario: "Kary Jimenez", ventaTotal: 2500 } },
      { datos_originales: { fecha: "2026-10-12", folio: "A-3", usuario: "Karla", ventaTotal: 900 } },
      { datos_originales: { fecha: "2026-10-06", folio: "A-4", usuario: "Otro", ventaTotal: 500 } },
    ],
  });
  assert.equal(resumen.tickets, 3);
  assert.equal(resumen.ventasPeriodo, 13000);
  assert.equal(resumen.ventasAsignadas, 12500);
  assert.equal(resumen.ventasSinAsignar, 500);
  assert.equal(resumen.comisionTotal, 125);
  assert.deepEqual(resumen.comisiones.map((item) => item.empleado), ["Karla", "Kary"]);
});

test("no calcula comisión cuando la asignación SICAR es ambigua", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05",
    hasta: "2026-10-11",
    empleados: [
      { id: "1", nombre: "Karla Centro", usuario_sicar: "Vendedora" },
      { id: "2", nombre: "Karla GA", usuario_sicar: " vendedora " },
    ],
    filas: [{ fecha: "05/10/2026", folio: "B-1", usuario: "Vendedora", totalVenta: "$2,000.00" }],
  });
  assert.equal(resumen.comisiones.length, 0);
  assert.equal(resumen.sinAsignar[0].motivo, "ASIGNACION_AMBIGUA");
  assert.equal(resumen.comisionTotal, 0);
});

test("reporta filas sin folio, usuario o fecha como no verificables", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados, filas: [
      { fecha: "2026-10-06", folio: "", usuario: "Karla", ventaTotal: 1000 },
    ],
  });
  assert.equal(resumen.filasSinIdentidad, 1);
  assert.equal(resumen.tickets, 0);
});

test("CRM atribuye al responsable por folio SICAR y deduplica tickets", () => {
  const resumen = resumirComisionesSicar({
    desde: "2026-10-05", hasta: "2026-10-11", empleados,
    oportunidadesCRM: [{ id: "o1", etapa: "GANADO", folio_venta_sicar: "A-9", empleado_id: "2" }],
    filas: [
      { datos_originales: { fecha: "2026-10-06", folio: "A-9", usuario: "Karla", ventaTotal: 4000 } },
      { datos_originales: { fecha: "2026-10-06", folio: "A-9", usuario: "Caja", ventaTotal: 4000 } },
    ],
  });
  assert.equal(resumen.tickets, 1);
  assert.equal(resumen.ventasAsignadas, 4000);
  assert.equal(resumen.comisiones.length, 1);
  assert.equal(resumen.comisiones[0].empleado, "Kary");
  assert.equal(resumen.comisiones[0].ticketsCRM, 1);
  assert.equal(resumen.comisionTotal, 40);
});