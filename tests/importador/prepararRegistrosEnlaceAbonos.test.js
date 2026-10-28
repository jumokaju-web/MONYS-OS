import test from "node:test";
import assert from "node:assert/strict";
import { prepararRegistrosEnlaceAbonos } from "../../src/features/importador/utils/prepararRegistrosEnlaceAbonos.js";

test("prepara en un lote los cheques únicos por proveedor sin tocar saldos", () => {
  const registros = prepararRegistrosEnlaceAbonos([
    { nombre: "Pink Up", items: [{ fila: { proveedorNombre: "Pink Up", metodoPago: "CH", fecha: "2026-10-19", monto: 30000, codigo: "ABONO-1", caja: "Caja 1" }, detalle: { id: "d1", importacion_id: "mov-1", codigo: "MOV-50" } }] },
    { nombre: "Amore Mio Bissu", items: [{ fila: { proveedorNombre: "Amore Mio Bissu", metodoPago: "CH", fecha: "2026-10-20", monto: 15439, codigo: "ABONO-2", caja: "Caja 1" }, detalle: { id: "d2", importacion_id: "mov-2", numero_fila: 94 } }] },
  ], { organizationId: "org", businessId: "business", branchId: "branch", importacionId: "abonos-1", archivoNombre: "AbonosProveedor.xlsx" });

  assert.equal(registros.length, 2);
  assert.deepEqual(registros.map(({ proveedorNombre, detalleId, importePago, tipoAplicacion }) => [proveedorNombre, detalleId, importePago, tipoAplicacion]), [
    ["Pink Up", "d1", 30000, "POR_DETERMINAR"],
    ["Amore Mio Bissu", "d2", 15439, "POR_DETERMINAR"],
  ]);
  assert.ok(registros.every((registro) => registro.evidencia.includes("AbonosProveedor.xlsx")));
});

test("un lote sin grupos no prepara escrituras", () => {
  assert.deepEqual(prepararRegistrosEnlaceAbonos(null), []);
  assert.deepEqual(prepararRegistrosEnlaceAbonos([{ nombre: "Sin filas", items: [] }]), []);
});
