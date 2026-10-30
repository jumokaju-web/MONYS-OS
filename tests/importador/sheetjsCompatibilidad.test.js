import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import * as codepages from "xlsx/dist/cpexcel.full.mjs";
import { leerExcel } from "../../src/core/engine/excelReader.js";
import { normalizarFechaSicar } from "../../src/features/importador/utils/periodoSicar.js";

test("carga SheetJS oficial 0.20.3 en la importación efectiva del proyecto", () => {
  assert.equal(XLSX.version, "0.20.3");
});

test("exporta y lee XLSX real preservando códigos de texto, decimales, fecha SICAR y fórmula con resultado guardado", async () => {
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet([
    ["Código", "Producto", "Fecha", "Cantidad", "Precio", "Importe"],
    // Mediodía evita que el serial de Excel cambie de día según la zona horaria
    // donde corre la prueba; SICAR importa una fecha comercial, no un instante UTC.
    ["001234567890", "Corrector Saniye", new Date("2026-10-12T12:00:00Z"), 2, 12.5, 25],
  ]);
  hoja.F2 = { t: "n", f: "D2*E2", v: 25 };
  XLSX.utils.book_append_sheet(libro, hoja, "Ventas SICAR");
  const bytes = XLSX.write(libro, { type: "array", bookType: "xlsx" });
  const resultado = await leerExcel({ name: "ventas.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes });
  assert.equal(resultado.exito, true);
  assert.equal(resultado.nombreHoja, "Ventas SICAR");
  assert.equal(resultado.datos[1][0], "001234567890");
  assert.equal(resultado.datos[1][4], 12.5);
  assert.equal(resultado.datos[1][5], 25);
  assert.equal(normalizarFechaSicar(resultado.datos[1][2]), "2026-10-12");
  assert.equal(resultado.workbook.Sheets["Ventas SICAR"].F2.f, "D2*E2");
});

test("CSV UTF8 puede conservar encabezados y códigos numéricos con ceros al leer sin inferencia de tipos", () => {
  const texto = 'Código,Producto,Fecha,Importe\n001234567890,Corrector Saniye,12/10/2026,12.50\n';
  const bytes = new TextEncoder().encode(texto);
  const libro = XLSX.read(bytes, { type: "array", raw: true, codepage: 65001 });
  const datos = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: "", blankrows: false });
  assert.equal(datos[0][0], "Código");
  assert.equal(datos[1][0], "001234567890");
  assert.equal(datos[1][2], "12/10/2026");
  assert.equal(Number(datos[1][3]), 12.5);
  assert.equal(normalizarFechaSicar(datos[1][2]), "2026-10-12");
});

test("una celda de texto que empieza con igual conserva su tipo y no ejecuta una fórmula", () => {
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet([["Código"], ["=1+1"]]);
  XLSX.utils.book_append_sheet(libro, hoja, "Productos");
  const bytes = XLSX.write(libro, { type: "array", bookType: "xlsx" });
  const leido = XLSX.read(bytes, { type: "array" });
  assert.equal(leido.Sheets.Productos.A2.t, "s");
  assert.equal(leido.Sheets.Productos.A2.v, "=1+1");
  assert.equal(leido.Sheets.Productos.A2.f, undefined);
});

test("el lector real de SICAR abre XLS BIFF8 conservando acentos, ceros iniciales e importes", async () => {
  const filas = [["Código", "Descripción", "Categoría", "Ventas"], ["001234567890", "Lápiz café y rubor melocotón", "Maquillaje de ojos", 12.5]];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), "Ventas SICAR");
  const bytes = XLSX.write(libro, { type: "array", bookType: "biff8" });
  const resultado = await leerExcel({ name: "ventas-sicar.xls", size: bytes.byteLength, arrayBuffer: async () => bytes });
  assert.equal(resultado.exito, true);
  assert.deepEqual(resultado.datos, filas);
});

// SheetJS escribe BIFF5 con sbcs y convierte caracteres no ASCII a '_'.
// Para probar el lector contra bytes BIFF5 reales de Windows-1252 se reemplaza
// cada LABEL por su codificación CP1252; no se configura el lector del proyecto.
function crearBiff5Windows1252(filas) {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), "Ventas SICAR");
  const bytes = XLSX.write(libro, { type: "array", bookType: "biff5" });
  const contenedor = XLSX.CFB.read(new Uint8Array(bytes), { type: "array" });
  const entrada = XLSX.CFB.find(contenedor, "/Book");
  const datos = entrada.content;
  for (let posicion = 0; posicion + 4 < datos.length;) {
    const registro = datos[posicion] | datos[posicion + 1] << 8;
    const longitud = datos[posicion + 2] | datos[posicion + 3] << 8;
    if (registro === 0x0204) {
      const inicio = posicion + 4;
      const fila = datos[inicio] | datos[inicio + 1] << 8;
      const columna = datos[inicio + 2] | datos[inicio + 3] << 8;
      const cantidad = datos[inicio + 6] | datos[inicio + 7] << 8;
      const texto = String(filas[fila][columna]);
      const codificado = codepages.utils.encode(1252, texto);
      assert.equal(cantidad, codificado.length);
      for (let indice = 0; indice < cantidad; indice += 1) datos[inicio + 8 + indice] = codificado[indice];
    }
    posicion += longitud + 4;
  }
  return new Uint8Array(XLSX.CFB.write(contenedor, { type: "array" })).buffer;
}

test("el lector real interpreta XLS legado BIFF5 Windows-1252 con acentos y símbolos sin corrupción", async () => {
  const filas = [["Código", "Descripción", "Ventas"], ["001234567890", "Lápiz café – promoción €", 12.5]];
  const bytes = crearBiff5Windows1252(filas);
  const resultado = await leerExcel({ name: "ventas-legado.xls", size: bytes.byteLength, arrayBuffer: async () => bytes });
  assert.equal(resultado.exito, true);
  assert.deepEqual(resultado.datos, filas);
});

test("el lector real importa CSV UTF8 SICAR con acentos y códigos numéricos de texto", async () => {
  const bytes = new TextEncoder().encode('Código,Descripción,Fecha,Importe\n001234567890,Lápiz café y rubor melocotón,12/10/2026,12.50\n');
  const resultado = await leerExcel({ name: "ventas.csv", type: "text/csv", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer });
  assert.equal(resultado.exito, true);
  assert.equal(resultado.datos[0][0], "Código");
  assert.equal(resultado.datos[1][0], "001234567890");
  assert.equal(resultado.datos[1][1], "Lápiz café y rubor melocotón");
  assert.equal(normalizarFechaSicar(resultado.datos[1][2]), "2026-10-12");
  assert.equal(Number(resultado.datos[1][3]), 12.5);
});
