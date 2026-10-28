import test from "node:test";
import assert from "node:assert/strict";
import { resumirSesionesCajaAbiertas } from "../../src/features/finanzas/utils/sesionesCajaAbiertas.js";
import { crearObservacionesAperturaCaja, crearObservacionesCorte } from "../../src/features/inteligencia/utils/capturasFinancierasEquipo.js";

const cierre = (id, branch_id, turno, observaciones, created_at) => ({ id, branch_id, turno, observaciones, created_at });

test("bloquea sesiones abiertas en cada sucursal sin confundir caja 1 entre sucursales", () => {
  const resultado = resumirSesionesCajaAbiertas([
    cierre("ap-centro", "centro", "apertura_caja", crearObservacionesAperturaCaja({ sesionCajaId: "s1", cajaId: "CAJA_1" }), "2026-10-28T15:00:00Z"),
    cierre("ap-anaya", "anaya", "apertura_caja", crearObservacionesAperturaCaja({ sesionCajaId: "s2", cajaId: "CAJA_1" }), "2026-10-28T15:01:00Z"),
  ]);
  assert.equal(resultado.cantidad, 2);
  assert.deepEqual(resultado.sesiones.map((item) => item.branchId).sort(), ["anaya", "centro"]);
});

test("un cierre posterior resuelve la apertura de su caja y sucursal", () => {
  const apertura = crearObservacionesAperturaCaja({ sesionCajaId: "s1", cajaId: "CAJA_1" });
  const observacionesCierre = crearObservacionesCorte({ cajaId: "CAJA_1", turnoCaja: "VESPERTINO" });
  const resultado = resumirSesionesCajaAbiertas([
    cierre("ap", "centro", "apertura_caja", apertura, "2026-10-28T15:00:00Z"),
    cierre("ci", "centro", "cierre_caja", observacionesCierre, "2026-10-28T23:00:00Z"),
  ]);
  assert.equal(resultado.cantidad, 0);
});
