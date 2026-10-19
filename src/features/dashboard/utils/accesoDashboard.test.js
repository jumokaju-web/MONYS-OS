import assert from "node:assert/strict";
import test from "node:test";

import { puedeCargarDatosDeDireccion } from "./accesoDashboard.js";

test("solo Dirección carga ventas, utilidad y sucursales del Dashboard", () => {
  assert.equal(puedeCargarDatosDeDireccion("owner"), true);
  assert.equal(puedeCargarDatosDeDireccion(" ADMIN "), true);

  for (const rol of ["vendedora", "chofer", "empleado", "consulta", ""]) {
    assert.equal(puedeCargarDatosDeDireccion(rol), false);
  }
});
