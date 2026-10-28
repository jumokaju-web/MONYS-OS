import test from "node:test";
import assert from "node:assert/strict";
import { adaptarIdentidadMovimientoTesoreria } from "../../src/features/tesoreria/utils/adaptarMovimientoTesoreria.js";
import { agruparMovimientosPendientes } from "../../src/features/tesoreria/utils/agruparMovimientosPendientes.js";

test("conserva cuenta, sucursal y referencia al adaptar un movimiento para la bandeja", () => {
  const registro = {
    organization_id: "org-1",
    business_id: "negocio-1",
    branch_id: "centro",
    account_id: "caja-centro",
    account_name: "Caja Centro",
    counterparty: "admin",
  };

  assert.deepEqual(adaptarIdentidadMovimientoTesoreria({
    ...registro,
    cuenta: { name: "Caja Centro" },
  }), registro);
});

test("mantiene explícitos los campos faltantes sin inventar una identidad", () => {
  assert.deepEqual(adaptarIdentidadMovimientoTesoreria({}), {
    organization_id: null,
    business_id: null,
    branch_id: null,
    account_id: null,
    account_name: "",
    counterparty: "",
  });
});

test("la bandeja no mezcla cuentas o contrapartes distintas después de adaptar filas", () => {
  const base = {
    id: "m-1",
    movement_type: "SALIDA",
    amount: 100,
    concept: "Movimiento de caja sin comentario",
    expense_category: "anticipo_prestamo",
    status: "Pendiente de revisión",
    occurred_at: "2026-10-19T12:00:00Z",
    organization_id: "org-1",
    business_id: "negocio-1",
    branch_id: "centro",
    account_id: "caja-1",
    counterparty: "admin",
  };
  const adaptado = (registro) => ({
    ...registro,
    ...adaptarIdentidadMovimientoTesoreria(registro),
  });

  const grupos = agruparMovimientosPendientes([
    adaptado(base),
    adaptado({ ...base, id: "m-2", account_id: "caja-2" }),
    adaptado({ ...base, id: "m-3", counterparty: "otra referencia" }),
  ]);

  assert.deepEqual(grupos, []);
});
