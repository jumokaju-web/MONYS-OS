import test from "node:test";
import assert from "node:assert/strict";
import {
  resumirCapturaRemanente,
  validarCapturaRemanente,
} from "../../src/features/finanzas/utils/remanenteSemanalCaptura.js";

const base = {
  efectivoSicar: "1250.00",
  efectivoContado: "1250.00",
  fondoFijo: "1000.00",
  montoResguardado: "250.00",
  destino: "Efectivo acumulado",
  referencia: "Bolsa sellada lunes",
  evidencia: { name: "foto.jpg" },
};

test("calcula el máximo resguardable sin tocar el fondo fijo y conserva el saldo de caja", () => {
  assert.equal(validarCapturaRemanente(base), null);
  assert.deepEqual(resumirCapturaRemanente(base), {
    montoResguardable: 250,
    efectivoDespues: 1000,
    diferenciaSicar: 0,
    coincideSicar: true,
  });
});

test("bloquea conteos faltantes, fondos mayores que el efectivo y resguardos mayores al disponible", () => {
  assert.match(validarCapturaRemanente({ ...base, efectivoContado: "" }), /importes válidos/i);
  assert.match(validarCapturaRemanente({ ...base, fondoFijo: "1300" }), /menor que el fondo fijo/i);
  assert.match(validarCapturaRemanente({ ...base, montoResguardado: "250.01" }), /excede el efectivo/i);
});

test("exige destino, referencia y evidencia cuando sí se resguarda dinero", () => {
  assert.match(validarCapturaRemanente({ ...base, destino: "" }), /destino real/i);
  assert.match(validarCapturaRemanente({ ...base, referencia: "" }), /referencia/i);
  assert.match(validarCapturaRemanente({ ...base, evidencia: null }), /evidencia/i);
});

test("permite registrar un conteo sin retiro y deja visible cualquier diferencia con SICAR", () => {
  const captura = { ...base, efectivoContado: "1249.50", montoResguardado: "0", destino: "", referencia: "", evidencia: null, nota: "Diferencia identificada" };
  assert.equal(validarCapturaRemanente(captura), null);
  assert.deepEqual(resumirCapturaRemanente(captura), {
    montoResguardable: 249.5,
    efectivoDespues: 1249.5,
    diferenciaSicar: -0.5,
    coincideSicar: false,
  });
});

test("exige explicación cuando el conteo físico no coincide con SICAR", () => {
  const capturaConDiferencia = { ...base, efectivoContado: "1249.50", montoResguardado: "249.50" };
  assert.match(validarCapturaRemanente(capturaConDiferencia), /diferencia/i);
  assert.equal(validarCapturaRemanente({ ...capturaConDiferencia, nota: "Movimiento posterior identificado" }), null);
});
