import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { leerExcel } from "./excelReader.js";

test("lee la primera hoja Excel y conserva encabezados como filas", async () => {
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet([
    ["Producto", "Ventas"],
    ["Base", 12],
  ]);
  XLSX.utils.book_append_sheet(libro, hoja, "Ventas SICAR");
  const buffer = XLSX.write(libro, { type: "array", bookType: "xlsx" });

  const resultado = await leerExcel({
    arrayBuffer: async () => buffer,
  });

  assert.equal(resultado.exito, true);
  assert.equal(resultado.nombreHoja, "Ventas SICAR");
  assert.deepEqual(resultado.datos, [["Producto", "Ventas"], ["Base", 12]]);
});
