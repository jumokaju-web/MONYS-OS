import test from "node:test";
import assert from "node:assert/strict";
import { precioMinimoRentable, validarTramosEnvio } from "../../src/core/canales/precioMinimo.js";

// Valores sintéticos.
const base = { costoUnitario: 100, comisionPct: 14, retencionIvaPct: 8, retencionIsrPct: 1, margenObjetivoPct: 20, envioFijo: 70 };

test("precio sin pérdida y con margen: las retenciones no reducen la utilidad comercial", () => {
  const r = precioMinimoRentable(base);
  // Sin pérdida: 0.86p − 170 ≥ 0 → 197.67 → 198
  assert.equal(r.precioSinPerdida, 198);
  // Con margen: 0.86p − 170 ≥ 0.20p → 257.6 → 258
  assert.equal(r.precioConMargen, 258);
  const d = r.desgloseConMargen;
  assert.equal(d.retencionIva, 20.64);
  assert.equal(d.retencionIsr, 2.58);
  // Efectivo tras retenciones ≠ utilidad comercial.
  assert.equal(d.utilidadComercial, Math.round((258 * 0.86 - 170) * 100) / 100);
  assert.equal(d.efectivoDespuesDeRetenciones, Math.round((258 * 0.77 - 170) * 100) / 100);
});

test("IVA trasladado: el margen se mide sobre el precio sin IVA", () => {
  const r = precioMinimoRentable({ ...base, ivaTrasladadoPct: 16 });
  assert.ok(r.precioConMargen > 258);
  assert.ok(Math.abs(r.desgloseConMargen.precioSinIva - r.precioConMargen / 1.16) < 0.01);
  assert.match(r.supuestos[0], /16% de IVA/);
});

test("el precio actual se evalúa directo, aunque esté arriba del mínimo (tramos no monótonos)", () => {
  // Bajo 299 el envío cuesta 40; desde 299, 150.
  const tramosEnvio = [{ desde: 0, hasta: 299, costo: 40 }, { desde: 299, hasta: null, costo: 150 }];
  const r = precioMinimoRentable({ ...base, envioFijo: null, tramosEnvio, precioActual: 310 });
  assert.equal(r.precioConMargen, 213); // 0.66p ≥ 140 → 212.1 → 213, con envío de 40
  // A 310 el envío salta a 150: 0.86·310 − 250 = 16.6 < 62 de margen.
  assert.equal(r.actual.veredicto, "debajo_del_margen");
  const bajo = precioMinimoRentable({ ...base, envioFijo: null, tramosEnvio, precioActual: 290 });
  assert.equal(bajo.actual.veredicto, "cumple");
  // Descuento máximo desde 290 hasta 213, sin rangos intermedios que fallen.
  assert.equal(bajo.actual.descuentoConMargen.precioMinimo, 213);
  assert.equal(bajo.actual.descuentoConMargen.maximoPct, 26.5);
  assert.deepEqual(bajo.actual.descuentoConMargen.rangosQueNoCumplen, []);
});

test("descuento máximo informa los rangos intermedios que no cumplen", () => {
  const tramosEnvio = [{ desde: 0, hasta: 299, costo: 40 }, { desde: 299, hasta: 400, costo: 150 }, { desde: 400, hasta: null, costo: 40 }];
  const r = precioMinimoRentable({ ...base, envioFijo: null, tramosEnvio, precioActual: 450 });
  assert.equal(r.actual.veredicto, "cumple");
  const huecos = r.actual.descuentoConMargen.rangosQueNoCumplen;
  assert.equal(huecos.length, 1);
  assert.equal(huecos[0][0], 299);
  assert.ok(huecos[0][1] >= 360 && huecos[0][1] < 400);
});

test("valida negativos, paso, tramos incompletos y límite de iteraciones", () => {
  for (const [cambio, texto] of [
    [{ envioFijo: -5 }, "envío fijo válido"],
    [{ extrasPct: -1 }, "extras"],
    [{ costoFijoUnidad: -2 }, "costo fijo"],
    [{ gananciaMinima: -10, margenObjetivoPct: null }, "ganancia mínima válido"],
    [{ precioActual: -100 }, "precio actual válido"],
    [{ paso: 0 }, "paso de cálculo"],
    [{ paso: "abc" }, "paso de cálculo válido"],
    [{ comisionPct: 100 }, "comisión"],
    [{ costoUnitario: true }, "costo SICAR"],
  ]) {
    const r = precioMinimoRentable({ ...base, ...cambio });
    assert.equal(r.calculable, false, JSON.stringify(cambio));
    assert.ok(r.faltantes.some((t) => t.includes(texto)), `${JSON.stringify(cambio)} → ${r.faltantes}`);
  }
  assert.ok(validarTramosEnvio([{ desde: 0, hasta: 200, costo: 40 }, { desde: 250, hasta: null, costo: 70 }]).errores[0].includes("hueco"));
  assert.ok(validarTramosEnvio([{ desde: 0, hasta: 300, costo: 40 }, { desde: 250, hasta: null, costo: 70 }]).errores[0].includes("solapados"));
  assert.ok(validarTramosEnvio([{ desde: 100, hasta: null, costo: 40 }]).errores.includes("los tramos deben empezar en 0"));
  assert.ok(validarTramosEnvio([{ desde: 0, hasta: 300, costo: 40 }]).errores.includes("el último tramo debe quedar sin límite"));
  assert.ok(validarTramosEnvio([{ desde: 0, hasta: null, costo: -1 }]).errores[0].includes("costo inválido"));
  const iteraciones = precioMinimoRentable({ ...base, paso: 0.01, costoUnitario: 5000 });
  assert.equal(iteraciones.calculable, false);
  assert.match(iteraciones.faltantes[0], /paso de cálculo más grande/);
});

test("sin costo SICAR, retenciones o envío no calcula; 0 explícito sí vale", () => {
  const r = precioMinimoRentable({ comisionPct: 14, margenObjetivoPct: 20 });
  assert.equal(r.calculable, false);
  for (const texto of ["costo SICAR", "retención de IVA", "retención de ISR", "envío"]) {
    assert.ok(r.faltantes.some((t) => t.includes(texto)), texto);
  }
  assert.equal(precioMinimoRentable({ ...base, retencionIvaPct: 0, retencionIsrPct: 0 }).calculable, true);
});
