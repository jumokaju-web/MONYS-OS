import test from "node:test";
import assert from "node:assert/strict";
import { resumirCortesOficialesParaDisponibilidad } from "../../src/features/finanzas/utils/disponibilidadCortesOficiales.js";

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

function importacion(cortes) {
  return [{
    id: "imp-1",
    branch_id: "centro",
    archivo_original: "cortes.xlsx",
    created_at: "2026-10-24T18:00:00Z",
    cortes,
  }];
}

function corte(caja, fecha = "2026-10-24", contado = 1000, retirado = 800) {
  return {
    fecha,
    hora: caja === "Caja 1" ? "18:00" : "18:05",
    caja,
    contado: 1500,
    diferenciaOperativa: 0,
    desgloseContadoCoincide: true,
    metodos: [
      { clave: "efectivo", contado, retirado },
      { clave: "tarjeta", contado: 500, retirado: 0 },
    ],
  };
}

test("usa solo el efectivo que quedó en caja y no suma tarjeta ni retiros", () => {
  const resumen = resumirCortesOficialesParaDisponibilidad({
    hoy: "2026-10-24",
    cierre,
    importaciones: importacion([corte("Caja 1"), corte("Caja 2", "2026-10-24", 1200, 900)]),
  });
  assert.equal(resumen.completo, true);
  assert.equal(resumen.efectivoEnCaja, 500);
  assert.equal(resumen.efectivoRetirado, 1700);
});

test("un corte anterior queda como referencia y no se usa como efectivo de hoy", () => {
  const resumen = resumirCortesOficialesParaDisponibilidad({
    hoy: "2026-10-24",
    cierre,
    importaciones: importacion([corte("Caja 1", "2026-10-23"), corte("Caja 2", "2026-10-23")]),
  });
  assert.equal(resumen.disponible, true);
  assert.equal(resumen.vigente, false);
  assert.equal(resumen.fechaUltimoCorte, "2026-10-23");
  assert.equal(resumen.efectivoEnCaja, null);
  assert.equal(resumen.completo, false);
});

test("si falta una caja no convierte su efectivo en cero", () => {
  const resumen = resumirCortesOficialesParaDisponibilidad({
    hoy: "2026-10-24",
    cierre,
    importaciones: importacion([corte("Caja 1")]),
  });
  assert.equal(resumen.cajasFaltantes, 1);
  assert.equal(resumen.efectivoEnCaja, null);
  assert.equal(resumen.completo, false);
});

test("un desglose inconsistente deja la caja incompleta", () => {
  const caja1 = corte("Caja 1");
  caja1.desgloseContadoCoincide = false;
  const resumen = resumirCortesOficialesParaDisponibilidad({
    hoy: "2026-10-24",
    cierre,
    importaciones: importacion([caja1, corte("Caja 2")]),
  });
  assert.equal(resumen.cajasIncompletas, 1);
  assert.equal(resumen.completo, false);
});
