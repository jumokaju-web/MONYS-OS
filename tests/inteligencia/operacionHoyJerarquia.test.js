import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fuente = readFileSync(new URL("../../src/features/inteligencia/components/OperacionHoy.jsx", import.meta.url), "utf8");

test("Operación muestra control y reparto antes de las evidencias", () => {
  const control = fuente.indexOf("<ControlDiarioSucursal");
  const reparto = fuente.indexOf("<RutinaTienda");
  const evidencias = fuente.indexOf('<details className="operation-evidence-gallery">');
  assert.ok(control > 0);
  assert.ok(reparto > control);
  assert.ok(evidencias > reparto);
});

test("la consulta histórica y las fotos permanecen plegadas en móvil", () => {
  assert.match(fuente, /<details className="operation-date-picker">/);
  assert.match(fuente, /Abre únicamente cuando necesites comprobar una evidencia/);
});
