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

test("descarta filas sin fecha o folio y conserva los ajustes negativos verificables", () => {
  const filas = [
    ["Documento", "Fecha", "Folio", "Cliente", "Caja", "Usuario", "Total Ven.", "Total Com.", "Utilidad"],
    ["Venta", "2026-10-05", "", "Cliente", "Caja 1", "Karla", 500, 300, 200],
    ["Venta", "", "F-002", "Cliente", "Caja 1", "Karla", 500, 300, 200],
    ["Devolución", "2026-10-06", "F-003", "Cliente", "Caja 1", "Karla", -250, -150, -100],
  ];

  const resultado = normalizarUtilidadVentas(filas);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].folio, "F-003");
  assert.equal(resultado[0].ventaTotal, -250);
});
