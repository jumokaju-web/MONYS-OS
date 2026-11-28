import test from "node:test";
import assert from "node:assert/strict";
import { conciliarMovimientoPlataforma } from "../../src/core/finanzas/conciliacionPlataformas.js";

// Sintético.
const mov = { id: "m1", amount: 500, business_id: "b" };
const canal = { cuentaId: "ml1", operaciones: ["O1", "O2"], gastosVentaBase: { comisiones: 300, envios: 200 } };
const v = (extra) => ({ id: Math.random().toString(16).slice(2), cash_movement_id: "m1", business_id: "b", cuenta_id: "ml1", estado: "verificado", ...extra });

test("conciliación parcial: excluye lo ligado a operaciones y deja el resto como cargo", () => {
  const r = conciliarMovimientoPlataforma(mov, [
    v({ tipo_operacion: "comision", referencia_externa: "O1", monto_conciliado: 300 }),
    v({ tipo_operacion: "cargo_plataforma", referencia_externa: "FACT", monto_conciliado: 200 }),
  ], [canal], { businessId: "b" });
  assert.equal(r.excluido, 300);
  assert.equal(r.restante, 200);
  assert.equal(r.estado, "parcial");
  assert.match(r.detalle[1].motivo, /no viene restado/);
  assert.equal(r.cuentaDelRestante, "ml1");
});

test("solo excluye vínculos verificados, del negocio, con referencia del periodo y dato en el canal", () => {
  const casos = [
    [v({ estado: "propuesto", tipo_operacion: "comision", referencia_externa: "O1", monto_conciliado: 100 }), /sin verificar/],
    [v({ business_id: "otro", tipo_operacion: "comision", referencia_externa: "O1", monto_conciliado: 100 }), /otro negocio/],
    [v({ tipo_operacion: "comision", referencia_externa: "O9", monto_conciliado: 100 }), /no está en las operaciones/],
    [v({ cuenta_id: "tt1", tipo_operacion: "comision", referencia_externa: "O1", monto_conciliado: 100 }), /sin datos/],
  ];
  for (const [vinculo, motivo] of casos) {
    const r = conciliarMovimientoPlataforma(mov, [vinculo], [canal], { businessId: "b" });
    assert.equal(r.excluido, 0);
    assert.match(r.detalle[0].motivo, motivo);
  }
  const sinComision = conciliarMovimientoPlataforma(mov, [v({ tipo_operacion: "comision", referencia_externa: "O1", monto_conciliado: 100 })], [{ ...canal, gastosVentaBase: { comisiones: null } }], { businessId: "b" });
  assert.equal(sinComision.excluido, 0);
});

test("nunca excluye más que el movimiento; anulados no cuentan", () => {
  const r = conciliarMovimientoPlataforma(mov, [
    v({ tipo_operacion: "comision", referencia_externa: "O1", monto_conciliado: 400 }),
    v({ tipo_operacion: "envio", referencia_externa: "O2", monto_conciliado: 400 }),
    v({ tipo_operacion: "envio", referencia_externa: "O2", monto_conciliado: 50, estado: "anulado" }),
  ], [canal], { businessId: "b" });
  assert.equal(r.excluido, 500);
  assert.equal(r.restante, 0);
  assert.equal(r.estado, "conciliado");
  assert.equal(r.detalle.length, 2);
  assert.equal(conciliarMovimientoPlataforma(mov, [], [canal]).estado, "sin_conciliar");
});
