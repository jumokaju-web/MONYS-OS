import test from "node:test";
import assert from "node:assert/strict";
import { resumirEvidenciaPagoProveedor } from "../../src/features/importador/utils/evidenciaPagoProveedor.js";

const sicar = (id = "sicar-1", estado = "ACTIVA") => ({
  id,
  importacion_detalle_id: "detalle-1",
  cash_movement_id: "caja-1",
  estado,
});
const banco = (id = "banco-1", estado = "ACTIVA") => ({
  id,
  revision_bancaria_id: "revision-1",
  cash_movement_id: "caja-1",
  fecha_banco: "2026-10-26",
  cuenta: "1234",
  monto: 300,
  direccion: "SALIDA",
  estado,
  snapshot: { banco: { descripcion: "CHEQUE PINK UP", cargo: 300 } },
});

test("une SICAR, caja y banco solo mediante el mismo movimiento de caja ya conciliado", () => {
  const resultado = resumirEvidenciaPagoProveedor({
    detalleId: "detalle-1",
    conciliacionesSicar: [sicar()],
    conciliacionesBancarias: [banco()],
    pagoProveedor: { id: "pago-1", estado: "ACTIVA", proveedor_nombre_snapshot: "Pink Up", tipo_aplicacion: "ABONO", importe_pago: 300 },
  });
  assert.equal(resultado.estado, "TRES_FUENTES_VINCULADAS");
  assert.equal(resultado.cashMovementId, "caja-1");
  assert.equal(resultado.banco.descripcion, "CHEQUE PINK UP");
  assert.deepEqual(resultado.pagoProveedor, { id: "pago-1", proveedor: "Pink Up", tipoAplicacion: "ABONO", importe: 300 });
});

test("distingue cuando el cheque todavía no está unido a Tesorería o al banco", () => {
  assert.equal(resumirEvidenciaPagoProveedor({ detalleId: "detalle-1" }).estado, "FALTA_TESORERIA");
  assert.equal(resumirEvidenciaPagoProveedor({ detalleId: "detalle-1", conciliacionesSicar: [sicar()] }).estado, "FALTA_BANCO");
});

test("no escoge entre varias conciliaciones bancarias activas del mismo cheque", () => {
  const resultado = resumirEvidenciaPagoProveedor({
    detalleId: "detalle-1",
    conciliacionesSicar: [sicar()],
    conciliacionesBancarias: [banco("banco-1"), banco("banco-2")],
  });
  assert.equal(resultado.estado, "AMBIGUA_BANCO");
  assert.equal(resultado.banco, null);
  assert.equal(resultado.conciliacionesBancarias.length, 2);
});

test("ignora vínculos anulados y pagos anulados, sin perder el estado de revisión", () => {
  const resultado = resumirEvidenciaPagoProveedor({
    detalleId: "detalle-1",
    conciliacionesSicar: [sicar("sicar-cancelado", "ANULADA")],
    conciliacionesBancarias: [banco("banco-cancelado", "ANULADA")],
    pagoProveedor: { id: "pago-cancelado", estado: "ANULADA", proveedor_nombre_snapshot: "Pink Up" },
  });
  assert.equal(resultado.estado, "FALTA_TESORERIA");
  assert.equal(resultado.pagoProveedor, null);
});

test("marca ambigüedad en SICAR para no unir registros duplicados", () => {
  const resultado = resumirEvidenciaPagoProveedor({
    detalleId: "detalle-1",
    conciliacionesSicar: [sicar("sicar-1"), sicar("sicar-2")],
    conciliacionesBancarias: [banco()],
  });
  assert.equal(resultado.estado, "AMBIGUA_SICAR");
  assert.equal(resultado.cashMovementId, null);
});
