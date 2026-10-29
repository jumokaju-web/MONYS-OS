import test from "node:test";
import assert from "node:assert/strict";
import { resumirDisponibilidadFinanciera } from "../../src/features/finanzas/utils/disponibilidadFinanciera.js";

const retiro = {
  cierreId: "c1", branchId: "centro", cajaId: "CAJA_1", monto: 8000,
  estado: "IDENTIFICADO", destino: "DEPOSITO_BANCARIO", responsable: "Dirección", detalle: "BBVA",
};

function base() {
  return {
    hoy: "2026-10-15",
    cuentas: [{ id: "b1", saldo: 10000, fechaSaldo: "2026-10-15T12:00:00-06:00" }],
    cierre: { cajasEsperadas: 1, cajasFaltantes: 0, cajasIncompletas: 0, efectivoFinal: 3000, efectivoEntregado: 8000, diferencias: 0, retiros: [retiro] },
    creditosProveedores: { importacion: { id: "imp1", created_at: "2026-10-15T12:00:00Z" }, creditos: [{ saldo: 4000, fecha_vencimiento: "2026-10-18" }] },
    deudasConsultadas: true,
    deudasFinancieras: [],
    obligacionesOperativas: { completas: true, compromisos7Dias: 1000 },
    obligacionesOperativasConfirmadas: true,
    sesionesCajaConsultadas: true,
    movimientosPendientesConsultados: true,
  };
}

for (const estado of [null, "REPORTADO", "DIFERENCIA"]) {
  test(`un retiro ${estado || "sin comprobante"} no libera dinero aunque bancos y obligaciones estén completos`, () => {
    const resultado = resumirDisponibilidadFinanciera({
      ...base(),
      comprobacionesRetiros: estado ? [{ cierre_id: "c1", caja_id: "CAJA_1", version: 1, estado }] : [],
    });
    assert.equal(resultado.liquidezLocalizada, 13000);
    assert.equal(resultado.remanenteRegistrado, 8000);
    assert.equal(resultado.dineroLibre, null);
    assert.equal(resultado.calculable, false);
    assert.notEqual(resultado.prioridad.titulo, "Disponibilidad lista para decidir");
    assert.ok(resultado.faltantes.some((item) => item.id === "comprobaciones-retiros" && item.destino === "equipo"));
  });
}

test("comprobante aprobado libera solo el saldo localizado sin sumar nuevamente el retiro", () => {
  const resultado = resumirDisponibilidadFinanciera({
    ...base(),
    comprobacionesRetiros: [{ cierre_id: "c1", caja_id: "CAJA_1", version: 1, estado: "COMPROBADO" }],
  });
  assert.equal(resultado.calculable, true);
  assert.equal(resultado.dineroLibre, 8000);
  assert.equal(resultado.liquidezLocalizada, 13000);
  assert.equal(resultado.prioridad.titulo, "Disponibilidad lista para decidir");
  assert.ok(!resultado.faltantes.some((item) => item.id === "comprobaciones-retiros"));
});

test("un comprobante aprobado no resuelve un destino del retiro aún pendiente", () => {
  const entrada = base();
  entrada.cierre.retiros = [{ ...retiro, estado: "PENDIENTE" }];
  entrada.comprobacionesRetiros = [{ cierre_id: "c1", caja_id: "CAJA_1", version: 1, estado: "COMPROBADO" }];
  const resultado = resumirDisponibilidadFinanciera(entrada);
  assert.equal(resultado.calculable, false);
  assert.equal(resultado.dineroLibre, null);
  assert.ok(resultado.faltantes.some((item) => item.id === "retiros"));
});

test("la última revisión con diferencia vuelve a bloquear una comprobación previamente aprobada", () => {
  const resultado = resumirDisponibilidadFinanciera({
    ...base(),
    comprobacionesRetiros: [
      { cierre_id: "c1", caja_id: "CAJA_1", version: 1, estado: "COMPROBADO" },
      { cierre_id: "c1", caja_id: "CAJA_1", version: 2, estado: "DIFERENCIA" },
    ],
  });
  assert.equal(resultado.dineroLibre, null);
  assert.equal(resultado.calculable, false);
  assert.equal(resultado.comprobacionRetiros.diferencias, 1);
});

test("un cierre sin retiros no exige comprobantes inexistentes", () => {
  const entrada = base();
  entrada.cierre = { ...entrada.cierre, efectivoEntregado: 0, retiros: [] };
  const resultado = resumirDisponibilidadFinanciera(entrada);
  assert.equal(resultado.calculable, true);
  assert.equal(resultado.dineroLibre, 8000);
});
