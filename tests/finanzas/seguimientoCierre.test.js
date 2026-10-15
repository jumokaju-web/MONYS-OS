import test from "node:test";
import assert from "node:assert/strict";
import { claveSeguimientoCierre, crearObservacionesSeguimientoCierre, indexarSeguimientosCierre, leerSeguimientoCierre, mensajeSeguimientoCierre } from "../../src/features/finanzas/utils/seguimientoCierre.js";

test("registra el último seguimiento de cada sucursal, caja y fecha", () => {
  const datos = { fecha: "2026-10-14", branchId: "centro", cajaId: "CAJA_1", tipo: "importes", destinatario: "Karla", registradoPor: "Mónica" };
  const primero = { id: "s1", created_at: "2026-10-15T03:00:00Z", observaciones: crearObservacionesSeguimientoCierre({ ...datos, enviadoEn: "2026-10-15T03:00:00Z" }) };
  const ultimo = { id: "s2", created_at: "2026-10-15T04:00:00Z", observaciones: crearObservacionesSeguimientoCierre({ ...datos, enviadoEn: "2026-10-15T04:00:00Z" }) };
  const leido = leerSeguimientoCierre(primero.observaciones);
  assert.equal(leido.tipo, "importes");
  const indice = indexarSeguimientosCierre([ultimo, primero]);
  assert.equal(indice.get(claveSeguimientoCierre(datos)).registroId, "s2");
});

test("prepara mensajes distintos para un cierre faltante y uno incompleto", () => {
  const base = { fecha: "14/10/2026", sucursal: "Centro", caja: "Caja 1", destinatario: "Karla" };
  assert.match(mensajeSeguimientoCierre({ ...base, estado: "faltante" }), /Falta registrar el cierre/);
  assert.match(mensajeSeguimientoCierre({ ...base, estado: "incompleto" }), /faltan los importes y la evidencia/);
  assert.match(mensajeSeguimientoCierre({ ...base, estado: "incompleto" }), /Hola Karla/);
});
