import test from "node:test";
import assert from "node:assert/strict";
import { validarSucursalImportacion } from "../../src/features/importador/utils/validarSucursalImportacion.js";

const centro = { id: "centro-id", name: "Monys Glam · Centro" };
const general = { id: "general-id", name: "Monys Glam · General Anaya" };

test("exige sucursal antes de importar", () => {
  assert.match(validarSucursalImportacion([{ nombre: "ventas.xlsx" }], null), /Selecciona la sucursal/);
});

test("rechaza si el archivo Centro está asignado a General Anaya", () => {
  assert.match(validarSucursalImportacion([{ nombre: "RepUtilidadCentro.xlsx" }], general), /parece ser de Centro/);
});

test("rechaza colas con sucursales mezcladas", () => {
  assert.match(validarSucursalImportacion([
    { nombre: "RepUtilidadCentro.xlsx" },
    { nombre: "RepUtilidadGeneralAnaya.xlsx" },
  ], centro), /mezcla archivos/);
});

test("permite un archivo cuya sucursal coincide", () => {
  assert.equal(validarSucursalImportacion([{ nombre: "RepUtilidadGeneralAnaya.xlsx" }], general), null);
});

test("permite nombres sin sucursal detectable, con sucursal seleccionada", () => {
  assert.equal(validarSucursalImportacion([{ nombre: "Utilidad_octubre.xlsx" }], centro), null);
});
