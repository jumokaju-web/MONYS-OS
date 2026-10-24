import test from "node:test";
import assert from "node:assert/strict";
import { buscarProveedoresParaPago, resumirPagosProveedores } from "./crucePagosProveedores.js";

const proveedores = [
  { id: "p1", nombre: "Distribuidora Belleza Total", saldo: 5900 },
  { id: "p2", nombre: "Cosméticos del Centro", saldo: null },
];

test("propone proveedor solo cuando el nombre aporta evidencia suficiente", () => {
  const candidatos = buscarProveedoresParaPago({
    banco: { descripcion: "SPEI DISTRIBUIDORA BELLEZA TOTAL" },
    movimiento: { concepto: "Abono mercancía" },
    proveedores,
  });
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].nombre, "Distribuidora Belleza Total");
  assert.equal(candidatos[0].saldoReportado, 5900);
});

test("no convierte un pago genérico en proveedor identificado", () => {
  assert.deepEqual(buscarProveedoresParaPago({ banco: { descripcion: "TRANSFERENCIA A TERCERO" }, proveedores }), []);
});

test("solo resume pagos ya conciliados y conserva proveedor pendiente", () => {
  const resumen = resumirPagosProveedores({
    banco: [{ id: "b1", cargo: 59, descripcion: "PAGO PROVEEDOR", fecha_operacion: "2026-10-20" }],
    movimientos: [{ id: "m1", monto: 59, tipo: "SALIDA", categoria: "proveedor", concepto: "Abono mercancía" }],
    proveedores,
    conciliaciones: [{ id: "c1", estado: "ACTIVA", banco_movimiento_id: "b1", cash_movement_id: "m1" }],
  });
  assert.equal(resumen.filas.length, 1);
  assert.equal(resumen.sinProveedor, 1);
  assert.equal(resumen.identificados, 0);
});

test("respeta la sugerencia auditada aunque después cambie el catálogo", () => {
  const resumen = resumirPagosProveedores({
    banco: [{ id: "b1", cargo: 500, descripcion: "TRANSFERENCIA", fecha_operacion: "2026-10-20" }],
    movimientos: [{ id: "m1", monto: 500, tipo: "SALIDA", categoria: "proveedor", concepto: "Mercancía" }],
    proveedores: [],
    conciliaciones: [{
      id: "c1",
      estado: "ACTIVA",
      banco_movimiento_id: "b1",
      cash_movement_id: "m1",
      snapshot: { proveedores_sugeridos: [{ id: "p1", nombre: "Proveedor comprobado", saldoReportado: null }] },
    }],
  });
  assert.equal(resumen.identificados, 1);
  assert.equal(resumen.filas[0].candidatos[0].nombre, "Proveedor comprobado");
});
