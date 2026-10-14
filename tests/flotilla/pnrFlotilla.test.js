import test from "node:test";
import assert from "node:assert/strict";

import {
  calcularSaldoPnr,
  pnrEstaActivo,
  resumirPnr,
  validarAltaPnr,
  validarDescuentoPnr,
} from "../../src/features/flotilla/utils/pnrFlotilla.js";

test("un PNR exige ruta, ID verde y captura de origen", () => {
  assert.equal(validarAltaPnr({}).length, 3);
  assert.deepEqual(validarAltaPnr({ rutaId: "r1", paqueteId: "48151708615", captura: {} }), []);
});

test("el recordatorio permanece mientras el PNR siga abierto", () => {
  assert.equal(pnrEstaActivo("EN_INVESTIGACION"), true);
  assert.equal(pnrEstaActivo("CONVENIO_ACTIVO"), true);
  assert.equal(pnrEstaActivo("RESUELTO_SIN_COBRO"), false);
  assert.equal(pnrEstaActivo("LIQUIDADO"), false);
});

test("un descuento compartido reduce una sola vez el saldo del PNR", () => {
  const descuentos = [
    { monto: 500, aplica_socio: true, aplica_chofer: true, estado: "APLICADO" },
    { monto: 500, aplica_socio: true, aplica_chofer: true, estado: "APLICADO" },
  ];
  assert.equal(calcularSaldoPnr(2500, descuentos), 1500);
  assert.equal(validarDescuentoPnr({ saldo: 1500, monto: 500, desde: "2026-10-12", hasta: "2026-10-18" }), "");
  assert.match(validarDescuentoPnr({ saldo: 300, monto: 500, desde: "2026-10-12", hasta: "2026-10-18" }), /saldo pendiente/);
});

test("resume pendientes y saldo sin contar PNR resueltos", () => {
  assert.deepEqual(resumirPnr([
    { estado: "EN_INVESTIGACION", saldo: 0 },
    { estado: "CONVENIO_ACTIVO", saldo: 2000 },
    { estado: "RESUELTO_SIN_COBRO", saldo: 0 },
  ]), { activos: 2, conPenalidad: 1, saldo: 2000 });
});
