import test from "node:test";
import assert from "node:assert/strict";
import { agruparAbonosEnlazables } from "../../src/features/importador/utils/agruparAbonosEnlazables.js";

const fila = (codigo, proveedorNombre, metodoPago, monto, id, estadoCruce = "COINCIDENCIA_UNICA") => ({
  codigo,
  proveedorNombre,
  metodoPago,
  monto,
  estadoCruce,
  coincidencias: id ? [{ id }] : [],
});

test("mantiene los seis cheques atribuidos y permite enlazar el efectivo pendiente de Nekane", () => {
  const filas = [
    fila("ABONO-1", "PINK UP", "CH", 30000, "mov-1"),
    fila("ABONO-3", "JESSI MOIRA", "CH", 30000, "mov-2"),
    fila("ABONO-5", "RUBEN BEAUTY", "CH", 20000, "mov-3"),
    fila("ABONO-7", "AMORE MIO BISSU", "CH", 15439, "mov-4"),
    fila("ABONO-9", "AMORE MIO BISSU", "CH", 1290, "mov-5"),
    fila("ABONO-11", "NEKANE", "CH", 1812.75, "mov-6"),
    fila("ABONO-13", "NEKANE", "EF", 1170, "mov-7"),
  ];
  const grupos = agruparAbonosEnlazables(filas, new Set(["mov-1", "mov-2", "mov-3", "mov-4", "mov-5", "mov-6"]));

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].nombre, "NEKANE");
  assert.equal(grupos[0].metodoPago, "EF");
  assert.equal(grupos[0].items[0].fila.codigo, "ABONO-13");
  assert.equal(grupos[0].total, 1170);
});

test("no enlaza cruces ambiguos, incompletos, sin proveedor o ya guardados", () => {
  const filas = [
    fila("ambigua", "Proveedor", "CH", 100, "mov-1", "AMBIGUA"),
    fila("sin-detalle", "Proveedor", "EF", 100, null),
    fila("sin-proveedor", "", "EF", 100, "mov-2"),
    fila("ya-guardada", "Proveedor", "CH", 100, "mov-3"),
  ];
  assert.deepEqual(agruparAbonosEnlazables(filas, new Set(["mov-3"])), []);
});

test("separa por proveedor y método y suma en centavos", () => {
  const grupos = agruparAbonosEnlazables([
    fila("cheque", "Nekane", "CH", 1812.75, "mov-ch"),
    fila("efectivo", "NEKANE", "EF", 1170, "mov-ef"),
  ]);
  assert.deepEqual(grupos.map(({ nombre, metodoPago, total }) => [nombre, metodoPago, total]), [
    ["Nekane", "CH", 1812.75],
    ["NEKANE", "EF", 1170],
  ]);
});
