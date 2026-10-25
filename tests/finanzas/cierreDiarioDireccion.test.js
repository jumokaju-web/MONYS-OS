import test from "node:test";
import assert from "node:assert/strict";
import { resumirCierreDiarioDireccion } from "../../src/features/finanzas/utils/cierreDiarioDireccion.js";

function captura({ id, branchId, cajaId, createdAt, venta = 0, efectivoFinal = 0, entregado = 0, incompleto = false, destino = null }) {
  return {
    tipo: "caja",
    cierre: { id, branch_id: branchId, created_at: createdAt, fecha: "2026-10-15" },
    datos: {
      cajaId,
      registroIncompleto: incompleto,
      ventaSicar: venta,
      cobrado: venta,
      efectivoFinal,
      efectivoEntregado: entregado,
      destinoEfectivoRetirado: destino?.tipo,
      responsableEfectivoRetirado: destino?.responsable,
      detalleEfectivoRetirado: destino?.detalle,
      diferenciaVenta: 0,
      diferenciaCaja: 0,
    },
  };
}

test("el cierre ejecutivo usa la fecha de México y no la fecha UTC equivocada del registro antiguo", () => {
  const resumen = resumirCierreDiarioDireccion({
    fecha: "2026-10-14",
    sucursales: [
      { id: "centro", nombre: "Sucursal Centro" },
      { id: "anaya", nombre: "Sucursal General Anaya" },
    ],
    capturas: [captura({ id: "c1", branchId: "centro", cajaId: "CAJA_1", createdAt: "2026-10-15T02:15:00.000Z", incompleto: true })],
  });
  assert.equal(resumen.cajasEsperadas, 3);
  assert.equal(resumen.cajasCompletas, 0);
  assert.equal(resumen.cajasIncompletas, 1);
  assert.equal(resumen.cajasFaltantes, 2);
  assert.equal(resumen.sucursales.find((s) => s.branchId === "centro").cajas[0].estado, "incompleto");
});

test("suma únicamente el último corte completo de cada caja y conserva las faltantes", () => {
  const resumen = resumirCierreDiarioDireccion({
    fecha: "2026-10-14",
    sucursales: [{ id: "centro", name: "Centro" }],
    capturas: [
      captura({ id: "nuevo", branchId: "centro", cajaId: "CAJA_1", createdAt: "2026-10-15T03:00:00.000Z", venta: 10000, efectivoFinal: 1000, entregado: 4000 }),
      captura({ id: "anterior", branchId: "centro", cajaId: "CAJA_1", createdAt: "2026-10-15T02:00:00.000Z", venta: 9000, efectivoFinal: 900, entregado: 3000 }),
    ],
  });
  assert.equal(resumen.cajasCompletas, 1);
  assert.equal(resumen.cajasFaltantes, 1);
  assert.equal(resumen.ventaSicar, 10000);
  assert.equal(resumen.efectivoFinal, 1000);
  assert.equal(resumen.efectivoEntregado, 4000);
  assert.equal(resumen.retiros[0].estado, "PENDIENTE");
});

test("identifica el destino del retiro cuando tiene responsable y referencia", () => {
  const resumen = resumirCierreDiarioDireccion({
    fecha: "2026-10-14",
    sucursales: [{ id: "centro", name: "Centro" }],
    capturas: [captura({
      id: "c1",
      branchId: "centro",
      cajaId: "CAJA_1",
      createdAt: "2026-10-15T03:00:00.000Z",
      entregado: 800,
      destino: { tipo: "RESGUARDO", responsable: "Mónica", detalle: "Caja fuerte" },
    })],
  });
  assert.equal(resumen.retiros[0].estado, "IDENTIFICADO");
  assert.equal(resumen.retiros[0].responsable, "Mónica");
});
