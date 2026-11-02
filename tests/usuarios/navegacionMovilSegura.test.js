import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Usuarios respeta las zonas seguras superior e inferior del teléfono", async () => {
  const fuente = await readFile(
    new URL(
      "../../src/features/usuarios/components/CentroUsuarios.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(fuente, /safe-area-inset-top/);
  assert.match(fuente, /safe-area-inset-bottom/);
  assert.match(fuente, /minHeight:\s*"44px"/);
});
