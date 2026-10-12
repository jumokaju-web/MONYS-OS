import assert from "node:assert/strict";
import test from "node:test";
import { esPerfilGrowth } from "../../src/features/inteligencia/shared/esPerfilGrowth.js";

test("reconoce a marketing aunque el puesto diga Centro de Crecimiento", () => {
  assert.equal(esPerfilGrowth({ puesto: "Centro de Crecimiento" }), true);
});

test("reconoce el área Growth aunque el puesto principal sea Operación", () => {
  assert.equal(
    esPerfilGrowth({
      puesto: "Operación",
      area: "Growth",
    }),
    true,
  );
});

test("mantiene fuera de Growth a los demás puestos", () => {
  assert.equal(
    esPerfilGrowth({
      puesto: "Vendedora",
      area: "Piso de venta",
    }),
    false,
  );
});

test("el puesto real de vendedora manda sobre un rol técnico de marketing", () => {
  assert.equal(
    esPerfilGrowth({
      puesto: "Vendedora",
      role: "marketing",
    }),
    false,
  );
});

test("usa el rol de marketing cuando todavía no existe una ficha de RH", () => {
  assert.equal(esPerfilGrowth({ role: "marketing" }), true);
});
