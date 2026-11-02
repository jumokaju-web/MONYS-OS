import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Marketing abre como agencia sin controles de asistencia ni cierre de tienda", async () => {
  const fuente = await readFile(
    new URL("../../src/features/inteligencia/components/InicioEmpleado.jsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    fuente,
    /<RegistroEntradaOperativa usuario=\{usuario\} \/>/,
    "el centro Growth no debe abrir con el reloj de entrada de tienda",
  );
  assert.doesNotMatch(
    fuente,
    /<CierreTurno branchId=\{branchId\} usuario=\{usuario\} \/>/,
    "el centro Growth no debe mostrar el cierre de turno de tienda",
  );
});
