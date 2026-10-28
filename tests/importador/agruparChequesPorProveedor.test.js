import test from "node:test";
import assert from "node:assert/strict";
import { agruparChequesPorProveedor } from "../../src/features/importador/utils/agruparChequesPorProveedor.js";

const item = (numero, proveedor, monto = 100) => ({
  fila: { codigoSicar: `MOV-${numero}`, fecha: `2026-10-${String(numero).padStart(2, "0")}`, monto, proveedoresCandidatos: proveedor },
  detalle: { id: `detalle-${numero}` },
  indice: numero,
});

test("agrupa cheques con proveedor único y suma en centavos", () => {
  const resultado = agruparChequesPorProveedor([
    item(1, [{ id: "pink-id", nombre: "Pink Up" }], 30.1),
    item(2, [{ id: "pink-id", nombre: "Pink Up" }], 19.9),
  ]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].items.length, 2);
  assert.equal(resultado[0].total, 50);
});

test("deja fuera candidatos ambiguos, sin proveedor, sin detalle o sin fecha/importe", () => {
  const resultado = agruparChequesPorProveedor([
    item(1, [{ id: "p", nombre: "Pink Up" }]),
    item(2, [{ id: "p", nombre: "Pink Up" }, { id: "q", nombre: "Pinky" }]),
    { ...item(3, [{ id: "p", nombre: "Pink Up" }]), detalle: null },
    { ...item(4, [{ id: "p", nombre: "Pink Up" }]), fila: { ...item(4, [{ id: "p", nombre: "Pink Up" }]).fila, fecha: null } },
    { ...item(5, [{ id: "p", nombre: "Pink Up" }]), fila: { ...item(5, [{ id: "p", nombre: "Pink Up" }]).fila, monto: 0 } },
  ]);
  assert.deepEqual(resultado, []);
});

test("no mezcla proveedores distintos aunque tengan el mismo nombre visible", () => {
  const resultado = agruparChequesPorProveedor([
    item(1, [{ id: "p-1", nombre: "Pink Up" }]),
    item(2, [{ id: "p-2", nombre: "Pink Up" }]),
  ]);
  assert.deepEqual(resultado, []);
});
