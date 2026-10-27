import test from "node:test";
import assert from "node:assert/strict";
import { cruzarChequesSicarConTesoreria } from "../../src/features/importador/utils/cruceSicarTesoreria.js";

const branchId = "centro-id";
const cheque = (codigo, monto, fecha = 46314) => ({ codigo, tipoMovimiento: "SALIDA", metodoPago: "CH", monto, fecha, caja: "Caja 1" });
const cash = (id, monto, options = {}) => ({ id, movement_type: "SALIDA", amount: monto, occurred_at: "2026-10-19T16:00:00.000Z", branch_id: branchId, status: "Pendiente de revisión", concept: "Sin comentario", ...options });

test("propone una coincidencia única sin confirmarla y evita registros cancelados", () => {
  const resultado = cruzarChequesSicarConTesoreria(
    [cheque("MOV-1", 15439)],
    [cash("coincide", 15439), cash("cancelado", 15439, { status: "Cancelado" })],
    branchId,
  );

  assert.equal(resultado.candidatasUnicas, 1);
  assert.equal(resultado.filas[0].estadoCruce, "CANDIDATA_UNICA");
  assert.equal(resultado.filas[0].candidatos[0].id, "coincide");
  assert.match(resultado.aclaracion, /No confirma/);
});

test("marca ambigüedad si varios movimientos o varios cheques comparten fecha e importe", () => {
  const resultado = cruzarChequesSicarConTesoreria(
    [cheque("MOV-1", 30000), cheque("MOV-2", 30000)],
    [cash("a", 30000), cash("b", 30000)],
    branchId,
  );

  assert.equal(resultado.ambiguas, 2);
  assert.equal(resultado.filas[0].candidatos.length, 2);
  assert.equal(resultado.candidatasUnicas, 0);
});

test("acepta movimientos consolidados del negocio como candidatas de menor alcance y rechaza otra sucursal", () => {
  const resultado = cruzarChequesSicarConTesoreria(
    [cheque("MOV-1", 20000)],
    [
      cash("consolidado", 20000, { branch_id: null }),
      cash("otra-sucursal", 20000, { branch_id: "general-anaya-id" }),
    ],
    branchId,
  );

  assert.equal(resultado.filas[0].candidatos.length, 1);
  assert.equal(resultado.filas[0].candidatos[0].alcance, "Registro de negocio sin sucursal especificada");
});

test("no inventa una coincidencia cuando no hay mismo día, importe o dirección", () => {
  const resultado = cruzarChequesSicarConTesoreria(
    [cheque("MOV-1", 20000)],
    [cash("otro-dia", 20000, { occurred_at: "2026-10-20T16:00:00.000Z" }), cash("otra-direccion", 20000, { movement_type: "ENTRADA" })],
    branchId,
  );

  assert.equal(resultado.sinCoincidencia, 1);
});
