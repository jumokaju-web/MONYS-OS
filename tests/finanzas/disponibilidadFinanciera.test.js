import test from "node:test";
import assert from "node:assert/strict";
import { resumirDisponibilidadFinanciera } from "../../src/features/finanzas/utils/disponibilidadFinanciera.js";

const cierreCompleto = {
  cajasEsperadas: 3,
  cajasFaltantes: 0,
  cajasIncompletas: 0,
  efectivoFinal: 3000,
  efectivoEntregado: 8000,
  diferencias: 0,
};

const proveedoresConfirmados = {
  importacion: { id: "imp-1", created_at: "2026-10-15T12:00:00Z" },
  creditos: [{ saldo: 4000, fecha_vencimiento: "2026-10-18" }],
};

test("no usa como disponible un saldo bancario de otro día", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 9000, fechaSaldo: "2026-10-14T20:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.liquidezLocalizada, null);
  assert.equal(resumen.dineroLibre, null);
  assert.equal(resumen.prioridad.destino, "bancos");
});

test("separa efectivo resguardado para evitar sumarlo dos veces", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.liquidezLocalizada, 13000);
  assert.equal(resumen.efectivoResguardado, 8000);
  assert.equal(resumen.dineroLibre, 9000);
});

test("un proveedor sin vencimiento bloquea dinero libre aunque el saldo sea conocido", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: { id: "imp-1", created_at: "2026-10-15T12:00:00Z" },
      creditos: [{ saldo: 4000, fecha_vencimiento: null }],
    },
  });
  assert.equal(resumen.liquidezLocalizada, 13000);
  assert.equal(resumen.dineroLibre, null);
  assert.match(resumen.prioridad.titulo, /vencimientos/i);
});

test("un reporte antiguo de proveedores no libera dinero", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    creditosProveedores: {
      importacion: { id: "imp-1", created_at: "2026-08-06T12:00:00Z" },
      creditos: [{ saldo: 4000, fecha_vencimiento: "2026-10-18" }],
    },
  });
  assert.equal(resumen.liquidezLocalizada, 13000);
  assert.equal(resumen.dineroLibre, null);
  assert.match(resumen.prioridad.titulo, /actualiza/i);
});

test("un cierre incompleto no se sustituye por efectivo cero", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: { ...cierreCompleto, cajasIncompletas: 1, efectivoFinal: 0 },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.efectivoCajas, null);
  assert.equal(resumen.liquidezLocalizada, null);
  assert.equal(resumen.prioridad.destino, "importador");
});

test("prefiere el corte oficial y separa el efectivo retirado", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    cortesOficiales: {
      completo: true,
      cajasEsperadas: 3,
      efectivoEnCaja: 1250,
      efectivoRetirado: 9750,
      diferencias: 0,
    },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.fuenteCajas, "SICAR_OFICIAL");
  assert.equal(resumen.efectivoCajas, 1250);
  assert.equal(resumen.efectivoResguardado, 9750);
  assert.equal(resumen.liquidezLocalizada, 11250);
  assert.equal(resumen.dineroLibre, 7250);
});

test("mantiene el cierre del equipo como respaldo cuando no hay corte oficial completo", () => {
  const resumen = resumirDisponibilidadFinanciera({
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T21:00:00-06:00" }],
    cierre: cierreCompleto,
    cortesOficiales: { completo: false, cajasFaltantes: 3 },
    creditosProveedores: proveedoresConfirmados,
  });
  assert.equal(resumen.fuenteCajas, "CIERRE_EQUIPO");
  assert.equal(resumen.efectivoCajas, 3000);
  assert.equal(resumen.dineroLibre, 9000);
});
