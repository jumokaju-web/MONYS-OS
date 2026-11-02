import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Kary recibe tres decisiones principales y un encabezado seguro", async () => {
  const inicio = await readFile(
    new URL(
      "../../src/features/inteligencia/components/InicioEmpleado.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const centro = await readFile(
    new URL(
      "../../src/features/inteligencia/components/director-marketing/CentroTrabajoGrowth.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(inicio, /safe-area-inset-top/);
  assert.match(inicio, /"Qué hago hoy"/);
  assert.match(inicio, /"Crear campaña"/);
  assert.match(inicio, /"Resultados"/);
  assert.match(centro, /Tu marketing de hoy/);
  assert.match(centro, /Una decisión a la vez/);
  assert.match(centro, /Elige una de las tres opciones/);
});
