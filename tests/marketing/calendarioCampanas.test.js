import assert from "node:assert/strict";
import test from "node:test";

import { claveFechaMexico } from "../../src/features/inteligencia/components/director-marketing/calendarioCampanasMarketingUtils.js";

test("el calendario agrupa por el día real de México y no por UTC", () => {
  assert.equal(claveFechaMexico("2026-11-02T03:30:00.000Z"), "2026-11-01");
});

test("el calendario conserva el día siguiente cuando ya cambió en México", () => {
  assert.equal(claveFechaMexico("2026-11-02T08:30:00.000Z"), "2026-11-02");
});

test("una fecha imposible no entra al calendario", () => {
  assert.equal(claveFechaMexico("fecha-invalida"), null);
});
