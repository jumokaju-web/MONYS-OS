import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extraerTextoPdfBancario } from "../../src/features/tesoreria/utils/extraerTextoPdfBancario.js";

test("PDF.js y su worker se pueden incluir en el build del cliente", async () => {
  const worker = await readFile(new URL("../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url));
  assert.ok(worker.length > 1000);
});

test("rechaza archivos que no son PDF antes de iniciar el lector", async () => {
  const archivo = { name: "estado.pdf", type: "application/pdf", size: 8, arrayBuffer: async () => new TextEncoder().encode("no pdf!!").buffer };
  await assert.rejects(extraerTextoPdfBancario(archivo), /firma PDF válida/);
});

test("rechaza estados bancarios mayores a 25 MB", async () => {
  const archivo = { name: "estado.pdf", type: "application/pdf", size: 25 * 1024 * 1024 + 1, arrayBuffer: async () => new ArrayBuffer(0) };
  await assert.rejects(extraerTextoPdfBancario(archivo), /supera 25 MB/);
});
