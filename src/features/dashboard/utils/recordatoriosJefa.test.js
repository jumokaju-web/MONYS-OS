import test from "node:test";
import assert from "node:assert/strict";
import { construirRecordatoriosJefa } from "./recordatoriosJefa.js";

const ahora = new Date("2026-10-22T18:00:00-06:00");

test("crea un recordatorio para toda sucursal activa sin carga SICAR reciente", () => {
  const recordatorios = construirRecordatoriosJefa({
    ahora,
    sucursales: [
      { id: "centro", name: "Centro", active: true },
      { id: "anaya", name: "General Anaya", active: true },
      { id: "nueva", name: "Nueva sucursal", active: true },
      { id: "cerrada", name: "Cerrada", active: false },
    ],
    importaciones: [
      { branch_id: "centro", created_at: "2026-10-20T12:00:00-06:00" },
      { branch_id: "anaya", created_at: "2026-10-15T12:00:00-06:00" },
    ],
    ultimoSaldo: "2026-10-20T12:00:00-06:00",
  });

  assert.deepEqual(recordatorios.map(({ branchId }) => branchId), ["anaya", "nueva"]);
  assert.equal(recordatorios.some(({ branchId }) => branchId === "cerrada"), false);
  assert.match(recordatorios[0].titulo, /General Anaya/);
  assert.match(recordatorios[1].detalle, /No hay una carga/);
});

test("no genera recordatorio SICAR antes de cumplir siete días", () => {
  const recordatorios = construirRecordatoriosJefa({
    ahora,
    sucursales: [{ id: "centro", name: "Centro", active: true }],
    importaciones: [{ branch_id: "centro", created_at: "2026-10-16T18:00:00-06:00" }],
    ultimoSaldo: "2026-10-22T17:00:00-06:00",
  });

  assert.deepEqual(recordatorios, []);
});

test("reporta saldo bancario pendiente si no hay saldo confirmado reciente", () => {
  const recordatorios = construirRecordatoriosJefa({ ahora, ultimoSaldo: null });
  assert.equal(recordatorios.length, 1);
  assert.equal(recordatorios[0].tipo, "tesoreria");
});
