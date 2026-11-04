import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el horario diario inicia compacto y conserva su formulario editable", async () => {
  const fuente = await readFile(
    new URL(
      "../../src/features/inteligencia/components/HorarioDelDiaEmpleado.jsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(fuente, /<details/);
  assert.match(fuente, /📅 Horario previsto/);
  assert.match(fuente, /\{resumenHorario\} · Editar/);
  assert.match(fuente, /Guardar mi horario/);
  assert.doesNotMatch(fuente, /<details\s+open/);
});
