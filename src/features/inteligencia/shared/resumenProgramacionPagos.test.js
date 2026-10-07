import assert from "node:assert/strict";
import test from "node:test";
import { calcularMensualidadesConFecha } from "./resumenProgramacionPagos.js";

test("suma compromisos con fecha aunque la lista visible se limite a seis", () => {
  const deudas = Array.from({ length: 8 }, (_, indice) => ({
    estado: "ACTIVA",
    fecha_proximo_pago: `2026-11-${String(indice + 1).padStart(2, "0")}`,
    pago_mensual: 100 + indice,
  }));

  assert.deepEqual(calcularMensualidadesConFecha(deudas), {
    cantidad: 8,
    montoTotal: 828,
  });
});

test("excluye créditos cerrados y registros incompletos", () => {
  assert.deepEqual(
    calcularMensualidadesConFecha([
      { estado: "ACTIVA", fecha_proximo_pago: "2026-11-01", pago_mensual: "250" },
      { estado: "CERRADA", fecha_proximo_pago: "2026-11-02", pago_mensual: 900 },
      { estado: "REESTRUCTURADA", fecha_proximo_pago: null, pago_mensual: 300 },
      { estado: "ACTIVA", fecha_proximo_pago: "2026-11-04", pago_mensual: 0 },
      { estado: "ACTIVA", fecha_proximo_pago: "2026-11-05", pago_mensual: "no válido" },
    ]),
    { cantidad: 1, montoTotal: 250 },
  );
});

test("acepta una colección vacía o inválida sin fallar", () => {
  assert.deepEqual(calcularMensualidadesConFecha(), {
    cantidad: 0,
    montoTotal: 0,
  });
  assert.deepEqual(calcularMensualidadesConFecha(null), {
    cantidad: 0,
    montoTotal: 0,
  });
});
