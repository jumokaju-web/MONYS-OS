import test from "node:test";
import assert from "node:assert/strict";
import { proponerCrucesFacturasEstadoCuenta } from "../../src/features/tesoreria/utils/cruceFacturasEstadoCuenta.js";

test("sugiere un abono por importe y fecha sin confirmar la conciliación", () => {
  const resultados = proponerCrucesFacturasEstadoCuenta(
    [{ folio: "F13", total: "40364.52", estado_pago: "PAGADA", estado_conciliacion: "PENDIENTE", pagada_en: "2026-10-23T21:59:50Z" }],
    { movimientos: [{ id: "b1", abono: "40364.52", fecha_operacion: "2026-10-24" }] },
  );
  assert.equal(resultados[0].estado, "COINCIDENCIA_UNICA");
  assert.equal(resultados[0].candidatos[0].id, "b1");
});

test("deja importes o fechas fuera de tolerancia sin coincidencia y no incluye canceladas", () => {
  const resultados = proponerCrucesFacturasEstadoCuenta([
    { total: 23954, estado_pago: "PAGADA", estado_conciliacion: "PENDIENTE", pagada_en: "2026-10-23T21:00:00Z" },
    { total: 100, estado_pago: "CANCELADA", estado_conciliacion: "PENDIENTE", pagada_en: "2026-10-23T21:00:00Z" },
  ], { movimientos: [{ id: "b2", abono: "23954.01", fecha_operacion: "2026-10-23" }] });
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].estado, "SIN_COINCIDENCIA");
});

test("marca ambiguas las coincidencias bancarias repetidas", () => {
  const resultados = proponerCrucesFacturasEstadoCuenta(
    [{ total: 100, estado_pago: "PAGADA", estado_conciliacion: "PENDIENTE", pagada_en: "2026-10-23T21:00:00Z" }],
    { movimientos: [{ id: "b1", abono: 100, fecha_operacion: "2026-10-23" }, { id: "b2", abono: 100, fecha_operacion: "2026-10-24" }] },
  );
  assert.equal(resultados[0].estado, "AMBIGUA");
});
