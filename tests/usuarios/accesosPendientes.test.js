import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Usuarios muestra el personal pendiente y abre su alta ya vinculada", async () => {
  const fuente = await readFile(
    new URL(
      "../../src/features/usuarios/components/CentroUsuarios.jsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(fuente, /Personal pendiente de acceso/);
  assert.match(fuente, /abrirFormularioParaEmpleada/);
  assert.match(fuente, /empleado_id: empleada\?\.id/);
  assert.match(fuente, /Dar acceso a \{empleada\.nombre\}/);
});
