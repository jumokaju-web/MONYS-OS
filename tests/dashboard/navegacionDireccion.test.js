import test from "node:test";
import assert from "node:assert/strict";
import {
  crearNavegacionDireccion,
  DESTINOS_DIRECCION,
} from "../../src/features/dashboard/utils/navegacionDireccion.js";

test("cada botón de Dirección conserva una acción comprobable", () => {
  const aperturas = [];
  const acciones = Object.fromEntries(
    DESTINOS_DIRECCION.map((destino) => [
      `abrir${destino[0].toUpperCase()}${destino.slice(1)}`,
      () => aperturas.push(destino),
    ]),
  );
  const navegacion = crearNavegacionDireccion({
    abrirOperacion: acciones.abrirOperacion,
    abrirFinanzas: acciones.abrirFinanzas,
    abrirInventario: acciones.abrirInventario,
    abrirCompraMaestra: acciones.abrirCompraMaestra,
    abrirMarketing: acciones.abrirMarketing,
    abrirFlotilla: acciones.abrirFlotilla,
    abrirEquipo: acciones.abrirEquipo,
    abrirJunta: acciones.abrirJunta,
    abrirTesoreria: acciones.abrirTesoreria,
    abrirReportes: acciones.abrirReportes,
    abrirUsuarios: acciones.abrirUsuarios,
  });

  DESTINOS_DIRECCION.forEach((destino) => navegacion[destino]());
  assert.deepEqual(aperturas, DESTINOS_DIRECCION);
});

test("un permiso ausente no rompe la portada", () => {
  const navegacion = crearNavegacionDireccion({});
  assert.equal(navegacion.finanzas(), false);
  assert.equal(navegacion.flotilla(), false);
});
