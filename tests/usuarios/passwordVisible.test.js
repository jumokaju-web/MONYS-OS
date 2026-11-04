import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const archivos = [
  ["inicio de sesión", "../../src/features/auth/components/Login.jsx"],
  ["alta de usuarios", "../../src/features/usuarios/components/CentroUsuarios.jsx"],
  ["alta de personal desde RH", "../../src/features/inteligencia/components/director-rh/DirectorRH.jsx"],
  ["recuperación de contraseña", "../../src/features/auth/components/RecuperarPassword.jsx"],
];

for (const [pantalla, ruta] of archivos) {
  test(`${pantalla} permite mostrar y ocultar la contraseña`, async () => {
    const fuente = await readFile(new URL(ruta, import.meta.url), "utf8");
    assert.match(fuente, /type=\{\s*mostrar/);
    assert.match(fuente, /aria-label=\{\s*mostrar/);
    assert.match(fuente, /👁️/);
    assert.match(fuente, /🙈/);
  });
}
