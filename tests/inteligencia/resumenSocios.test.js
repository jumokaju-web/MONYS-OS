import test from "node:test";
import assert from "node:assert/strict";
import { construirResumenSocios } from "../../src/features/flotilla/components/services/resumenSocios.js";

test("sin datos capturados conserva promedios ausentes", () => {
 const [socio] = construirResumenSocios({ unidades: [{ id: "u1", propietarios: ["Kary"] }], rutas: [{ unidad_id: "u1", paquetes_total: null, paros_total: "", kilometros_ruta: undefined }] });
 assert.equal(socio.paquetesPromedio, null);
 assert.equal(socio.parosPromedio, null);
 assert.equal(socio.kilometrosPromedio, null);
});
