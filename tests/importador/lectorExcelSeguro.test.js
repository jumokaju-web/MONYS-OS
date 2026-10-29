import test from "node:test";
import assert from "node:assert/strict";
import { leerExcel } from "../../src/core/engine/excelReader.js";

test("rechaza archivos grandes y extensiones ajenas antes de leerlos", async () => {
  for (const archivo of [{ name: "sicar.xlsx", size: 10 * 1024 * 1024 + 1 }, { name: "archivo.pdf", size: 100 }]) {
    let lecturas = 0;
    const resultado = await leerExcel({ ...archivo, arrayBuffer: async () => { lecturas++; return new ArrayBuffer(100); } });
    assert.equal(resultado.exito, false);
    assert.equal(lecturas, 0);
  }
});

test("no confía solo en el tamaño declarado y rechaza un archivo vacío", async () => {
  for (const buffer of [new ArrayBuffer(0), new ArrayBuffer(10 * 1024 * 1024 + 1)]) {
    const resultado = await leerExcel({ name: "sicar.xlsx", size: 1, arrayBuffer: async () => buffer });
    assert.equal(resultado.exito, false);
    assert.match(resultado.error, /vacío|10 MB/);
  }
});

test("el lector real preserva códigos con ceros iniciales y acentos del CSV", async () => {
  const buffer = new TextEncoder().encode('Código,Descripción,Precio\r\n001234567890,Lápiz para cejas,12.50\r\n').buffer;
  const resultado = await leerExcel({ name: "sicar.csv", type: "text/csv", size: buffer.byteLength, arrayBuffer: async () => buffer });
  assert.equal(resultado.exito, true);
  assert.deepEqual(resultado.datos, [["Código", "Descripción", "Precio"], ["001234567890", "Lápiz para cejas", "12.50"]]);
});
