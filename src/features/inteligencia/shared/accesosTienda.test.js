import assert from "node:assert/strict";
import test from "node:test";

import {
  crearRutaTurnoTienda,
  resolverAccesosTienda,
  resolverSiguienteAccionTurno,
} from "./accesosTienda.js";

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
    puedePedidos: false,
    puedeEnvios: false,
    puedeProponerReposicion: false,
    operaSola: false,
  });
});

test("la supervendedora trabaja pedidos, envíos y reposición sin recibir caja automáticamente", () => {
  const acceso = resolverAccesosTienda({
    responsabilidades: [
      "VENTA_TIENDA",
      "PEDIDOS_EN_LINEA",
      "ENVIOS_TIENDA",
      "PROPONER_REPOSICION",
      "OPERACION_SOLA",
    ],
    permisos: ["registrar_producto_solicitado"],
  });

  assert.equal(acceso.puedePedidos, true);
  assert.equal(acceso.puedeEnvios, true);
  assert.equal(acceso.puedeProponerReposicion, true);
  assert.equal(acceso.operaSola, true);
  assert.equal(acceso.puedeCaja, false);
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

test("la ruta de una vendedora sin caja no le pide completar el cierre", () => {
  const ruta = crearRutaTurnoTienda({
    puedeRegistrarProducto: true,
    puedeRegistrarIncidencias: true,
    puedeCaja: false,
  });

  assert.deepEqual(ruta[2], {
    titulo: "Lo que pasó",
    descripcion: "Deja solicitudes e incidencias con datos claros.",
  });
  assert.deepEqual(ruta[3], {
    titulo: "Cierre de turno",
    descripcion: "Revisa pendientes y deja tu trabajo actualizado.",
  });
});

test("la ruta conserva caja y cierre cuando la responsabilidad está habilitada", () => {
  const ruta = crearRutaTurnoTienda({ puedeCaja: true });

  assert.deepEqual(ruta[3], {
    titulo: "Caja y cierre",
    descripcion: "Completa caja antes de terminar.",
  });
});

test("la siguiente acción exige entrada antes de mostrar las tareas", () => {
  const accion = resolverSiguienteAccionTurno({
    jornadaCargando: false,
    entradaRegistrada: false,
    tareasCargando: false,
    tareasPendientes: 4,
  });

  assert.equal(accion.id, "ENTRADA");
});

test("la siguiente acción prioriza trabajo iniciado sobre trabajo pendiente", () => {
  const accion = resolverSiguienteAccionTurno({
    jornadaCargando: false,
    entradaRegistrada: true,
    tareasCargando: false,
    tareasPendientes: 3,
    tareasEnProceso: 1,
  });

  assert.equal(accion.id, "TAREAS");
  assert.match(accion.titulo, /Continúa/);
});

test("cero tareas no se interpreta como turno terminado", () => {
  const accion = resolverSiguienteAccionTurno({
    jornadaCargando: false,
    entradaRegistrada: true,
    salidaRegistrada: false,
    tareasCargando: false,
  });

  assert.equal(accion.id, "PLAN");
  assert.match(accion.descripcion, /no significa que el turno terminó/i);
});
