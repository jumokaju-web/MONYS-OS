import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const fuente = readFileSync(new URL("../../src/features/inteligencia/services/cierresTurnoService.js", import.meta.url), "utf8")
  .replace(/^import .*;$/gm, "").replace(/export async function/g, "async function");

function cargar(data) {
  const contexto = { supabase: { functions: { invoke: async () => ({ data, error: null }) } }, console };
  vm.runInNewContext(`${fuente}\nthis.analizar = analizarPatronesCierresIA;`, contexto);
  return contexto.analizar;
}

test("un análisis no guardado no llega a la creación automática de tareas del consumidor", async () => {
  const analizar = cargar({ ok: true, patrones: { acciones_prioritarias: ["revisar"] }, guardado: false, advertencia: "No se guardó el resultado" });
  let automatizaciones = 0;
  await assert.rejects(async () => { await analizar({ branchId: null }); automatizaciones++; }, /No se guardó/);
  assert.equal(automatizaciones, 0);
});

test("un análisis guardado conserva el contrato de patrones", async () => {
  const data = { ok: true, guardado: true, patrones: { total_cierres: 1 } };
  assert.equal(await cargar(data)({ branchId: "sucursal" }), data);
});
