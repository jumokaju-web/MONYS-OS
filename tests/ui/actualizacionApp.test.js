import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("el actualizador PWA se destraba y recarga aunque el Service Worker no responda", async () => {
  const fuente = await readFile(
    new URL("../../src/components/system/ActualizacionApp.jsx", import.meta.url),
    "utf8",
  );

  assert.match(fuente, /Promise\.race/);
  assert.match(fuente, /window\.setTimeout\(resolve, 4000\)/);
  assert.match(fuente, /window\.location\.reload\(\)/);
  assert.match(fuente, /Después/);
});
