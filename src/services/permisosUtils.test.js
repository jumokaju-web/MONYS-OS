import assert from "node:assert/strict";
import test from "node:test";
import { combinarPermisosEfectivos } from "./permisosUtils.js";

test("conserva los permisos del rol cuando no hay excepciones", () => {
  assert.deepEqual(
    combinarPermisosEfectivos(["ver_ventas", "ver_inventario"]),
    ["ver_ventas", "ver_inventario"]
  );
});

test("permite dar acceso individual aunque el rol no lo incluya", () => {
  assert.deepEqual(
    combinarPermisosEfectivos(
      ["ver_ventas"],
      [{ permission: "ver_logistica", allowed: true }]
    ),
    ["ver_ventas", "ver_logistica"]
  );
});

test("permite quitar acceso individual aunque el rol lo incluya", () => {
  assert.deepEqual(
    combinarPermisosEfectivos(
      ["ver_ventas", "ver_finanzas"],
      [{ permission: "ver_finanzas", allowed: false }]
    ),
    ["ver_ventas"]
  );
});
