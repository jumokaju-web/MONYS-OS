import test from "node:test";
import assert from "node:assert/strict";
import { normalizarUtilidadVentas } from "../../src/features/importador/utils/normalizador.js";

test("normaliza el reporte SICAR de utilidad de ventas para el cálculo de comisiones", () => {
  const filas = [
    ["Documento", "Fecha", "Folio", "Cliente", "Caja", "Usuario", "Total Ven.", "Total Com.", "Utilidad"],
    ["Venta", "2026-10-05", "F-001", "Cliente contado", "Caja 1", "Karla", 1250, 760, 490],
  ];

  assert.deepEqual(normalizarUtilidadVentas(filas), [
    {
      documento: "Venta",
      fecha: "2026-10-05",
      folio: "F-001",
      cliente: "Cliente contado",
      caja: "Caja 1",
      usuario: "Karla",
      codigo: "F-001",
      descripcion: "Cliente contado",
      categoria: "Utilidad de ventas",
      cantidad: 1,
      ventaTotal: 1250,
      costoTotal: 760,
      utilidad: 490,
      importe: 1250,
      costo: 760,
      tipoDato: "utilidad_ventas",
    },
  ]);
});

test("descarta filas sin folio y conserva filas sin fecha para revisión posterior", () => {
  const filas = [
    ["Documento", "Fecha", "Folio", "Cliente", "Caja", "Usuario", "Total Ven.", "Total Com.", "Utilidad"],
    ["Venta", "2026-10-05", "", "Cliente", "Caja 1", "Karla", 500, 300, 200],
    ["Venta", "", "F-002", "Cliente", "Caja 1", "Karla", 500, 300, 200],
    ["Devolución", "2026-10-06", "F-003", "Cliente", "Caja 1", "Karla", -250, -150, -100],
  ];

  const resultado = normalizarUtilidadVentas(filas);
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].folio, "F-002");
  assert.equal(resultado[0].fecha, "");
  assert.equal(resultado[1].folio, "F-003");
  assert.equal(resultado[1].ventaTotal, -250);
});


test("rechaza el reporte si faltan columnas financieras obligatorias", () => {
  const filas = [
    ["Documento", "Fecha", "Folio", "Cliente", "Caja", "Usuario", "Total Ven.", "Total Com."],
    ["Venta", "2026-10-05", "F-001", "Cliente", "Caja 1", "Karla", 1250, 760],
  ];

  assert.throws(
    () => normalizarUtilidadVentas(filas),
    /faltan columnas financieras obligatorias: Utilidad/
  );
});
test("normaliza la exportación real de SICAR con columnas intercaladas vacías", () => {
  const encabezados = [
    "Documento", "", "", "Fecha", "Folio", "", "Cliente", "",
    "Caja", "", "Usuario", "", "Folio F.", "", "", "Total Ven.",
    "", "", "", "Total Com.", "", "", "", "Utilidad",
  ];
  const venta = [
    "Tickets", "", "", "2026-09-28T10:25:39", "21095", "",
    "Público en General", "", "Caja 1", "", "sucursalcentro", "",
    "", "", "", "$ 422.31", "", "", "", "", "$ 256.00",
    "", "", "", "$ 166.31",
  ];

  const resultado = normalizarUtilidadVentas([encabezados, venta]);

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].documento, "Tickets");
  assert.equal(resultado[0].folio, "21095");
  assert.equal(resultado[0].usuario, "sucursalcentro");
  assert.equal(resultado[0].ventaTotal, 422.31);
  assert.equal(resultado[0].costoTotal, 256);
  assert.equal(resultado[0].utilidad, 166.31);
});
