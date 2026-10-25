import test from "node:test";
import assert from "node:assert/strict";
import { resumirDestinoEfectivoRetirado } from "../../src/features/finanzas/utils/destinoEfectivoRetirado.js";

const retiro = {
  branchId: "centro",
  cajaId: "CAJA_1",
  monto: 800,
  destino: "RESGUARDO",
  responsable: "Mónica",
  detalle: "Caja fuerte oficina",
  estado: "IDENTIFICADO",
};

test("concilia el retiro oficial con el destino declarado sin afirmar que está verificado", () => {
  const resumen = resumirDestinoEfectivoRetirado({
    cierre: { retiros: [retiro] },
    cortesOficiales: { completo: true, detalle: [{ branchId: "centro", cajaId: "CAJA_1", efectivoRetirado: 800 }] },
  });
  assert.equal(resumen.fuente, "SICAR_OFICIAL");
  assert.equal(resumen.identificados, 1);
  assert.equal(resumen.porDestino.RESGUARDO, 800);
  assert.equal(resumen.filas[0].responsable, "Mónica");
  assert.match(resumen.filas[0].etiquetaDestino, /resguardo/i);
});

test("mantiene pendiente un retiro oficial sin declaración del equipo", () => {
  const resumen = resumirDestinoEfectivoRetirado({
    cortesOficiales: { completo: true, detalle: [{ branchId: "centro", cajaId: "CAJA_1", efectivoRetirado: 800 }] },
  });
  assert.equal(resumen.pendientes, 1);
  assert.deepEqual(resumen.porDestino, {});
});

test("marca diferencia si el retiro oficial no coincide con el declarado", () => {
  const resumen = resumirDestinoEfectivoRetirado({
    cierre: { retiros: [retiro] },
    cortesOficiales: { completo: true, detalle: [{ branchId: "centro", cajaId: "CAJA_1", efectivoRetirado: 900 }] },
  });
  assert.equal(resumen.diferencias, 1);
  assert.equal(resumen.identificados, 0);
});

test("usa el cierre del equipo como respaldo cuando no hay corte oficial completo", () => {
  const resumen = resumirDestinoEfectivoRetirado({ cierre: { retiros: [retiro] } });
  assert.equal(resumen.fuente, "CIERRE_EQUIPO");
  assert.equal(resumen.identificados, 1);
  assert.equal(resumen.filas[0].etiquetaDestino, "Bajo resguardo");
});

test("un retiro histórico sin desglose permanece pendiente en vez de desaparecer", () => {
  const resumen = resumirDestinoEfectivoRetirado({ cierre: { efectivoEntregado: 8000 } });
  assert.equal(resumen.totalRetirado, 8000);
  assert.equal(resumen.pendientes, 1);
  assert.equal(resumen.filas[0].cajaId, "TOTAL");
});
