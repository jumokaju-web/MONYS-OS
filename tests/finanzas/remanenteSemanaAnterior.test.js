import test from "node:test";
import assert from "node:assert/strict";
import {
  obtenerSemanaCompletaAnterior,
  resumirRemanenteSemanaAnterior,
} from "../../src/features/finanzas/utils/remanenteSemanaAnterior.js";

const cierre = {
  sucursales: [{
    branchId: "centro",
    nombre: "Centro",
    cajas: [
      { cajaId: "CAJA_1", nombre: "Caja 1" },
      { cajaId: "CAJA_2", nombre: "Caja 2" },
    ],
  }],
};

function corte(caja, contado, retirado, diferencia = 0) {
  return {
    fecha: "2026-10-25",
    caja,
    metodos: [{ clave: "efectivo", contado, retirado }],
    diferenciaOperativa: diferencia,
    desgloseContadoCoincide: true,
  };
}

const importacion = (cortes) => [{ branch_id: "centro", id: "importacion-1", cortes }];

test("identifica la última semana completa lunes-domingo desde el lunes o entre semana", () => {
  assert.deepEqual(obtenerSemanaCompletaAnterior("2026-10-26"), {
    inicio: "2026-10-19",
    fin: "2026-10-25",
  });
  assert.deepEqual(obtenerSemanaCompletaAnterior("2026-10-28"), {
    inicio: "2026-10-19",
    fin: "2026-10-25",
  });
  assert.equal(obtenerSemanaCompletaAnterior("fecha-inválida"), null);
});

test("suma el efectivo al cierre del domingo después de retiros reportados", () => {
  const resumen = resumirRemanenteSemanaAnterior({
    importaciones: importacion([corte("Caja 1", 1500, 500), corte("Caja 2", 2200, 200)]),
    cierre,
    referencia: "2026-10-26",
  });
  assert.equal(resumen.completo, true);
  assert.equal(resumen.efectivoReportado, 3000);
  assert.equal(resumen.cajasEncontradas, 2);
  assert.equal(resumen.semana.inicio, "2026-10-19");
});

test("no presenta remanente si falta un corte o si SICAR reporta diferencias", () => {
  const faltaCaja = resumirRemanenteSemanaAnterior({
    importaciones: importacion([corte("Caja 1", 1500, 500)]),
    cierre,
    referencia: "2026-10-26",
  });
  assert.equal(faltaCaja.completo, false);
  assert.equal(faltaCaja.efectivoReportado, null);
  assert.equal(faltaCaja.cajasFaltantes, 1);

  const hayDiferencia = resumirRemanenteSemanaAnterior({
    importaciones: importacion([corte("Caja 1", 1500, 500, -25), corte("Caja 2", 2200, 200)]),
    cierre,
    referencia: "2026-10-26",
  });
  assert.equal(hayDiferencia.completo, false);
  assert.equal(hayDiferencia.efectivoReportado, null);
  assert.equal(hayDiferencia.diferencias, 1);
});
