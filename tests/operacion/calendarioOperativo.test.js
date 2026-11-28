import test from "node:test";
import assert from "node:assert/strict";
import { calendarioDelMes, calendarioDelNegocio, diasDelMes } from "../../src/core/operacion/calendarioOperativo.js";

// Sintético.
const dia = (fecha, estado, extra = {}) => ({ branch_id: "s1", fecha, estado, ...extra });

test("un día sin registro no se asume abierto ni cerrado", () => {
  const c = calendarioDelMes({ branchId: "s1", mes: "2026-11", dias: [dia("2026-11-02", "cerrado", { motivo: "Día de muertos" })] });
  assert.equal(c.vigencia, "desconocida");
  assert.equal(c.diasOperando.length, 30);
  assert.deepEqual(c.diasCerrados, ["2026-11-02"]);
  assert.equal(c.diasSinRegistro.length, 29);
  assert.equal(c.diasConVentaEsperada.length, 29);
});

test("vigencia: apertura a mitad de mes y cierre definitivo", () => {
  const abre = calendarioDelMes({ branchId: "s1", mes: "2026-11", vigencias: [{ branch_id: "s1", operando_desde: "2026-11-16" }] });
  assert.equal(abre.vigencia, "parcial");
  assert.equal(abre.diasFueraDeVigencia.length, 15);
  assert.equal(abre.diasOperando[0], "2026-11-16");
  const cerro = calendarioDelMes({ branchId: "s1", mes: "2026-12", vigencias: [{ branch_id: "s1", operando_desde: "2025-01-01", operando_hasta: "2026-11-30" }] });
  assert.equal(cerro.vigencia, "no_opera");
  assert.equal(cerro.diasConVentaEsperada.length, 0);
  // Reapertura: dos vigencias.
  const reabre = calendarioDelMes({ branchId: "s1", mes: "2026-11", vigencias: [
    { branch_id: "s1", operando_desde: "2025-01-01", operando_hasta: "2026-11-10" },
    { branch_id: "s1", operando_desde: "2026-11-21" },
  ] });
  assert.equal(reabre.diasFueraDeVigencia.length, 10);
});

test("horario reducido y minutos; mes en curso solo hasta ayer", () => {
  const c = calendarioDelMes({
    branchId: "s1", mes: "2026-11", hoy: "2026-11-27",
    dias: [
      dia("2026-11-05", "horario_reducido", { minutos_programados: 600, minutos_reales: 300, motivo: "inventario" }),
      dia("2026-11-06", "abierto", { minutos_programados: 600, minutos_reales: 600 }),
      dia("2026-11-07", "abierto"),
    ],
  });
  assert.equal(c.diasOperando.length, 26);
  assert.equal(c.diasFuturos.length, 4);
  assert.deepEqual(c.diasReducidos, [{ fecha: "2026-11-05", minutosProgramados: 600, minutosReales: 300, motivo: "inventario" }]);
  assert.equal(c.minutosProgramados, 1200);
  assert.equal(c.minutosReales, 900);
  assert.equal(c.minutosIncompletos, 1); // el 7 no trae minutos
  assert.deepEqual(c.diasAbiertosConfirmados, ["2026-11-06", "2026-11-07"]);
});

test("registros de otra sucursal no cuentan; mes inválido no calcula", () => {
  const n = calendarioDelNegocio({ sucursales: [{ id: "s1" }, { id: "s2" }], mes: "2026-11", dias: [dia("2026-11-02", "cerrado", { motivo: "x" })] });
  assert.equal(n.s1.diasCerrados.length, 1);
  assert.equal(n.s2.diasCerrados.length, 0);
  assert.equal(calendarioDelMes({ branchId: "s1", mes: "2026-13" }).calculable, false);
  assert.equal(diasDelMes("2028-02").length, 29);
});
