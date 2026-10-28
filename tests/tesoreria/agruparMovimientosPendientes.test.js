import test from "node:test";
import assert from "node:assert/strict";
import { agruparMovimientosPendientes } from "../../src/features/tesoreria/utils/agruparMovimientosPendientes.js";

const movimiento = (id, cambios = {}) => ({
  id,
  organization_id: "org-1",
  business_id: "negocio-1",
  branch_id: "centro",
  account_id: "caja-1",
  movement_type: "SALIDA",
  amount: 0,
  concept: "Movimiento de caja sin comentario",
  counterparty: "admin",
  expense_category: "anticipo_prestamo",
  expense_behavior: null,
  status: "Pendiente de revisión",
  occurred_at: "2026-10-19T12:00:00Z",
  ...cambios,
});

test("agrupa solo salidas pendientes con la misma referencia, cuenta y clasificación", () => {
  const movimientos = [
    movimiento("a", { amount: "30000.00" }),
    movimiento("b", { amount: "30000.00", occurred_at: "2026-10-20T12:00:00Z" }),
    movimiento("c", { amount: "20000.00", account_id: "caja-2" }),
    movimiento("d", { amount: "10000.00", counterparty: "otra persona" }),
    movimiento("e", { amount: "500.00", status: "Revisado" }),
    movimiento("f", { amount: "900.00", movement_type: "ENTRADA" }),
  ];

  const grupos = agruparMovimientosPendientes(movimientos);
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].ids, ["a", "b"]);
  assert.equal(grupos[0].total, 60000);
  assert.equal(grupos[0].movimientos.length, 2);
});

test("no redondea mal importes de centavos y no cambia los datos originales", () => {
  const primero = movimiento("a", { amount: "0.10" });
  const segundo = movimiento("b", { amount: "0.20" });
  const antes = structuredClone([primero, segundo]);

  const [grupo] = agruparMovimientosPendientes([primero, segundo]);

  assert.equal(grupo.total, 0.3);
  assert.deepEqual([primero, segundo], antes);
});

test("consolida el grupo real sin perder centavos y conserva sus siete referencias", () => {
  const importes = [30000, 30000, 20000, 15439, 1290, 1812.75, 1170];
  const movimientos = importes.map((amount, indice) => movimiento("mov-" + indice, {
    amount,
    occurred_at: "2026-10-" + (indice < 3 ? "19" : "20") + "T12:00:00Z",
  }));

  const [grupo] = agruparMovimientosPendientes(movimientos);

  assert.equal(grupo.movimientos.length, 7);
  assert.equal(grupo.total, 99711.75);
  assert.deepEqual(grupo.ids, importes.map((_, indice) => "mov-" + indice));
});

test("no agrupa entradas, movimientos únicos ni registros distribuidos", () => {
  const grupo = agruparMovimientosPendientes([
    movimiento("a"),
    movimiento("b", { distribuciones: [{ id: "partida" }] }),
    movimiento("c", { movement_type: "ENTRADA" }),
  ]);
  assert.deepEqual(grupo, []);
});
