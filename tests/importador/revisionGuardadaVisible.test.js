import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("revisar salidas lleva a la revisión guardada y muestra su progreso", async () => {
  const fuente = await readFile(
    new URL(
      "../../src/features/importador/components/ZonaCarga.jsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(fuente, /id="revision-sicar-guardada"/);
  assert.match(fuente, /getElementById\("revision-sicar-guardada"\)/);
  assert.match(fuente, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(fuente, /Abriendo movimientos SICAR y comparando con Tesorería/);
});
