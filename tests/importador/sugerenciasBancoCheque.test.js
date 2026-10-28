import test from "node:test";
import assert from "node:assert/strict";
import { sugerirBancoParaCheque } from "../../src/features/importador/utils/sugerenciasBancoCheque.js";

const banco = (id, cargo = 250, fecha = "2026-10-26") => ({
  id, cargo, abono: 0, fecha_operacion: fecha, fecha_liquidacion: fecha,
  cuenta: "BBVA Mónica", descripcion: `Cheque ${id}`,
});
const caja = { id: "caja-1", monto: 250, fecha: "2026-10-26", tipo: "salida" };

test("sugiere un solo cargo exacto de estado bancario al cheque ya vinculado a caja", () => {
  const resultado = sugerirBancoParaCheque({ banco: [banco("cargo-1")], movimientoCaja: caja });
  assert.equal(resultado.estado, "CANDIDATO_UNICO");
  assert.equal(resultado.candidatos[0].id, "cargo-1");
});

test("no elige entre cargos ambiguos ni propone importes, fechas o sentidos distintos", () => {
  assert.equal(sugerirBancoParaCheque({ banco: [banco("a"), banco("b")], movimientoCaja: caja }).estado, "AMBIGUO");
  for (const cambio of [{ cargo: 251 }, { fecha_operacion: "2026-10-27", fecha_liquidacion: "2026-10-27" }, { cargo: 0, abono: 250 }]) {
    assert.equal(sugerirBancoParaCheque({ banco: [{ ...banco("x"), ...cambio }], movimientoCaja: caja }).estado, "SIN_COINCIDENCIA");
  }
});

test("requiere vínculo previo SICAR–Tesorería y respeta un vínculo bancario existente", () => {
  assert.equal(sugerirBancoParaCheque({ banco: [banco("a")] }).estado, "REQUIERE_VINCULO_TESORERIA");
  assert.equal(sugerirBancoParaCheque({
    banco: [banco("a")], movimientoCaja: caja,
    conciliaciones: [{ estado: "ACTIVA", banco_movimiento_id: "a", cash_movement_id: caja.id }],
  }).estado, "VINCULADO");
});
