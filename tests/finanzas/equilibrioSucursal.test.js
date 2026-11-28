import test from "node:test";
import assert from "node:assert/strict";
import { equilibrioPorSucursal, gastosQueMasPesan } from "../../src/core/finanzas/equilibrioSucursal.js";
import { calendarioDelNegocio } from "../../src/core/operacion/calendarioOperativo.js";

// Estado base sintético (forma de construirEstadoResultados).
const estadoBase = {
  mes: "2026-10",
  unidades: [
    { unidad: "s1", nombre: "Centro", tipo: "sucursal", ingresos: 100000, utilidadBruta: 45000, gastosVentaTotal: 0, ventaPromedioDiaria: 3225.81,
      gastosDirectos: { porCategoria: [{ categoria: "RENTA", pagado: 15000, devengado: 15000 }, { categoria: "NOMINA", pagado: 20000, devengado: 20000 }, { categoria: "LUZ", pagado: 1000, devengado: 1000 }] } },
    { unidad: "s2", nombre: "Plaza", tipo: "sucursal", ingresos: 60000, utilidadBruta: 24000, gastosVentaTotal: 0, ventaPromedioDiaria: 1935.48,
      gastosDirectos: { porCategoria: [{ categoria: "NOMINA", pagado: 15000, devengado: 15000 }] } },
    { unidad: "canal:ml1", nombre: "Mercado Libre", tipo: "canal", ingresos: 20000, utilidadBruta: 10000, gastosVentaTotal: 6000 },
  ],
  generales: { devengado: 3000, porCategoria: [{ categoria: "SERVICIOS", pagado: 3000, devengado: 3000 }] },
  consolidado: { ingresos: 180000 },
};
const obligaciones = [
  { business_id: "b", branch_id: "s1", categoria: "RENTA", importe: 15000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-05" },
  { business_id: "b", branch_id: "s1", categoria: "NOMINA", importe: 20000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-30" },
  { business_id: "b", branch_id: "s2", categoria: "RENTA", importe: 10000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-05" },
  { business_id: "b", branch_id: "s2", categoria: "NOMINA", importe: 15000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-30" },
  { business_id: "b", categoria: "SERVICIOS", importe: 3000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-10" },
  { business_id: "b", categoria: "IMPUESTOS", importe: 9000, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-17" },
  { business_id: "otro", branch_id: "s1", categoria: "RENTA", importe: 99999, frecuencia: "MENSUAL", fecha_vencimiento: "2026-09-05" },
];

test("venta diaria necesaria por sucursal con el margen real y los días del calendario", () => {
  const cal = calendarioDelNegocio({ sucursales: [{ id: "s1" }, { id: "s2" }], mes: "2026-12", dias: [
    { branch_id: "s1", fecha: "2026-12-25", estado: "cerrado", motivo: "Navidad" },
    { branch_id: "s1", fecha: "2026-12-01", estado: "cerrado", motivo: "x" },
  ] });
  const r = equilibrioPorSucursal({ businessId: "b", estadoBase, mesObjetivo: "2026-12", obligaciones, calendario: cal });
  const [centro, plaza] = r.sucursales;
  assert.equal(centro.margenContribucionPct, 45);
  assert.equal(centro.diasConVentaEsperada, 29);
  // Gastos propios: renta 15 000 + nómina 20 000 + luz 1 000 (pagado, sin obligación) = 36 000.
  assert.equal(centro.gastosDirectosDevengados, 36000);
  assert.equal(centro.operativo.ventaMensual, 80000);
  assert.equal(centro.operativo.ventaDiaria, Math.round((80000 / 29) * 100) / 100);
  assert.ok(centro.avisos.some((a) => a.includes("luz")));
  // Plaza: renta 10 000 (obligación sin pago) + nómina 15 000, margen 40%.
  assert.equal(plaza.operativo.ventaMensual, 62500);
  assert.ok(plaza.operativo.brechaDiaria < 0); // vende menos de lo que necesita
  // Generales repartidos por ventas: supuesto aparte; impuestos y otro negocio fuera.
  assert.equal(r.generalesDevengados, 3000);
  assert.equal(plaza.operativoConGenerales.tipo, "SUPUESTO");
  assert.equal(plaza.generalesAsignados, Math.round(3000 * (60000 / 180000) * 100) / 100);
  assert.ok(!JSON.stringify(r).includes("99999"));
});

test("sin margen conocido no hay venta necesaria; sin calendario se avisa", () => {
  const sinCosto = { ...estadoBase, unidades: [{ ...estadoBase.unidades[0], utilidadBruta: null }] };
  const r = equilibrioPorSucursal({ businessId: "b", estadoBase: sinCosto, mesObjetivo: "2026-12", obligaciones });
  assert.equal(r.sucursales[0].operativo, null);
  assert.ok(r.sucursales[0].faltantes[0].includes("margen"));
  assert.ok(r.sucursales[0].avisos.some((a) => a.includes("Sin calendario")));
  assert.equal(r.sucursales[0].diasConVentaEsperada, 31);
});

test("gastos que más pesan, en % de ingresos y días de venta", () => {
  const [primero] = gastosQueMasPesan(estadoBase);
  assert.deepEqual([primero.categoria, primero.unidad, primero.pctIngresos], ["NOMINA", "s1", 20]);
  assert.equal(primero.diasDeVenta, Math.round((20000 / 3225.81) * 10) / 10);
});
