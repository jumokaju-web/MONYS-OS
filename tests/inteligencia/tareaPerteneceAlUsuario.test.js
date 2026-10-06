import assert from "node:assert/strict";
import test from "node:test";
import { tareaPerteneceAlUsuario } from "../../src/features/inteligencia/shared/tareaPerteneceAlUsuario.js";

test("usa el identificador autenticado cuando la tarea ya está vinculada", () => {
  const tarea = {
    responsable: "Ana Karina Jiménez Meza",
    responsable_usuario_id: "auth-kary",
  };

  assert.equal(
    tareaPerteneceAlUsuario(tarea, {
      authUserId: "auth-kary",
      nombreUsuario: "Otra persona",
    }),
    true,
  );
  assert.equal(
    tareaPerteneceAlUsuario(tarea, {
      authUserId: "auth-otra",
      nombreUsuario: "Ana Karina Jiménez Meza",
    }),
    false,
  );
});

test("no muestra tareas vinculadas cuando falta el usuario autenticado", () => {
  assert.equal(
    tareaPerteneceAlUsuario(
      { responsable_usuario_id: "auth-kary" },
      { authUserId: null, nombreUsuario: "Ana Karina Jiménez Meza" },
    ),
    false,
  );
});

test("conserva la coincidencia de nombre para tareas históricas sin vínculo", () => {
  assert.equal(
    tareaPerteneceAlUsuario(
      { responsable: "Ana Karina Jiménez Meza" },
      { authUserId: "auth-kary", nombreUsuario: "Kari Jiménez" },
    ),
    true,
  );
  assert.equal(
    tareaPerteneceAlUsuario(
      { responsable: "Karla Yoselin" },
      { authUserId: "auth-kary", nombreUsuario: "Kari Jiménez" },
    ),
    false,
  );
});
