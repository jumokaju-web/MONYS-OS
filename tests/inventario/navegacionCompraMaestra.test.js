import test from "node:test";
import assert from "node:assert/strict";
import { cambiarSeccionCompraMaestra } from "../../src/features/inventario/utils/navegacionCompraMaestra.js";

test("Traspasos cambia la sección y lleva la vista al contenido", () => {
  let seccionActiva = "resumen";
  let enfoques = 0;
  const programar = (accion) => accion();

  const cambio = cambiarSeccionCompraMaestra({
    seccion: "traspasos",
    actualizar: (seccion) => { seccionActiva = seccion; },
    enfocar: () => { enfoques += 1; },
    programar,
  });

  assert.equal(cambio, true);
  assert.equal(seccionActiva, "traspasos");
  assert.equal(enfoques, 1);
});

test("una sección desconocida no cambia Compra Maestra", () => {
  let cambios = 0;
  const cambio = cambiarSeccionCompraMaestra({
    seccion: "otra",
    actualizar: () => { cambios += 1; },
    enfocar: () => { cambios += 1; },
    programar: (accion) => accion(),
  });

  assert.equal(cambio, false);
  assert.equal(cambios, 0);
});
