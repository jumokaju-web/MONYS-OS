import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el Director IA usa el último inventario SICAR y no la tabla piloto", async () => {
  const fuente = await readFile(
    new URL(
      "../../src/features/inteligencia/services/inventarioAutomaticoService.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    fuente,
    /obtenerUltimaImportacionInventario/
  );
  assert.doesNotMatch(
    fuente,
    /\.from\(\s*["']inventario_existencias["']/
  );
  assert.match(
    fuente,
    /paquete\?\.detalles/
  );
});
