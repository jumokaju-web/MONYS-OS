import assert from "node:assert/strict";
import test from "node:test";

import { resolverAccesosTienda } from "./accesosTienda.js";

test("una vendedora sin responsabilidad de caja no puede abrir el cierre", () => {
  const acceso = resolverAccesosTienda({
    responsabilidades: ["VENTA_TIENDA"],
    permisos: ["registrar_producto_solicitado", "registrar_incidencias"],
  });

  assert.deepEqual(acceso, {
    puedeCaja: false,
    puedeWhatsApp: false,
    puedeRegistrarIncidencias: true,
    puedeRegistrarProducto: true,
  });
});

test("las funciones operativas sensibles requieren responsabilidad o permiso efectivo", () => {
  const acceso = resolverAccesosTienda({
    responsabilidades: ["VENTA_WHATSAPP", "CAJA_CORTE"],
    permisos: [],
  });

  assert.equal(acceso.puedeWhatsApp, true);
  assert.equal(acceso.puedeCaja, true);
  assert.equal(acceso.puedeRegistrarProducto, false);
  assert.equal(acceso.puedeRegistrarIncidencias, false);
});

test("un permiso de producto aislado no convierte otro puesto en vendedora", () => {
  const acceso = resolverAccesosTienda({
    responsabilidades: [],
    permisos: ["registrar_producto_solicitado"],
  });

  assert.equal(acceso.puedeRegistrarProducto, false);
});
