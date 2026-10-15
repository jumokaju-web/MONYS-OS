import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Marketing también recibe el registro personal de entrada", async () => {
  const fuente = await readFile(
    new URL("../../src/features/inteligencia/components/InicioEmpleado.jsx", import.meta.url),
    "utf8",
  );

  assert.match(fuente, /<RegistroEntradaOperativa usuario=\{usuario\} \/>/);
  assert.doesNotMatch(
    fuente,
    /!esMarketing\s*&&\s*<RegistroEntradaOperativa/,
    "el perfil de Marketing no debe quedar excluido del registro de entrada",
  );
});
