import test from "node:test";
import assert from "node:assert/strict";
import { desglosePrecio, envioPorTramos, precioMinimoRentable } from "../../src/core/canales/precioMinimo.js";

// Valores sintéticos.
const base = { costoUnitario: 100, comisionPct: 14, retencionPct: 9, margenObjetivoPct: 20, envioFijo: 70 };

test("precio mínimo con envío fijo: utilidad ≥ margen objetivo", () => {
  const r = precioMinimoRentable(base);
  assert.equal(r.calculable, true);
  // p − 0.14p − 70 − 0.09p − 100 ≥ 0.20p  →  p ≥ 170 / 0.57 = 298.2 → 299
  assert.equal(r.precioMinimo, 299);
  assert.ok(r.desglose.utilidad >= 299 * 0.2);
  const anterior = desglosePrecio(298, { ...base, envio: () => 70, costoFijoUnidad: 0, extrasPct: 0 });
  assert.ok(anterior.utilidad < 298 * 0.2);
});

test("con precio actual dice si pierde dinero o queda debajo del margen", () => {
  assert.equal(precioMinimoRentable({ ...base, precioActual: 150 }).veredicto, "pierde_dinero");
  assert.equal(precioMinimoRentable({ ...base, precioActual: 280 }).veredicto, "debajo_del_margen");
  const cumple = precioMinimoRentable({ ...base, precioActual: 320 });
  assert.equal(cumple.veredicto, "cumple");
  assert.equal(cumple.diferencia, -21);
});

test("envío por tramos: cruzar un umbral puede subir el precio necesario", () => {
  const tramos = [{ desde: 0, hasta: 299, costo: 40 }, { desde: 299, hasta: null, costo: 110 }];
  const envio = envioPorTramos(tramos);
  assert.equal(envio(298), 40);
  assert.equal(envio(299), 110);
  const r = precioMinimoRentable({ ...base, envioFijo: null, tramosEnvio: tramos });
  // Con 40 de envío: p ≥ 140 / 0.57 = 245.6 → 246 (está bajo el umbral).
  assert.equal(r.precioMinimo, 246);
  assert.equal(r.desglose.envio, 40);
});

test("ganancia mínima en pesos, extras de publicidad y costo fijo por unidad", () => {
  const r = precioMinimoRentable({ ...base, margenObjetivoPct: null, gananciaMinima: 50, extrasPct: 5, costoFijoUnidad: 10 });
  // p(1 − 0.14 − 0.09 − 0.05) − 70 − 10 − 100 ≥ 50 → p ≥ 230 / 0.72 = 319.4 → 320
  assert.equal(r.precioMinimo, 320);
});

test("sin costo SICAR, retención o envío no calcula y dice qué falta", () => {
  const r = precioMinimoRentable({ comisionPct: 14, margenObjetivoPct: 20 });
  assert.equal(r.calculable, false);
  assert.ok(r.faltantes.some((texto) => texto.includes("costo SICAR")));
  assert.ok(r.faltantes.some((texto) => texto.includes("retenciones")));
  assert.ok(r.faltantes.some((texto) => texto.includes("envío")));
  assert.equal(precioMinimoRentable({ ...base, retencionPct: 0 }).calculable, true); // 0 explícito sí vale
});
