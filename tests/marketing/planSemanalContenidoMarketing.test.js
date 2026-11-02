import assert from "node:assert/strict";
import test from "node:test";

import { generarPlanSemanalContenido } from "../../src/features/inteligencia/utils/planSemanalContenidoMarketing.js";

test("genera siete días y reutiliza productos reales sin inventar ofertas", () => {
  const plan = generarPlanSemanalContenido({
    fechaBase: new Date(2026, 10, 4),
    clientes: [{ id: "monys", nombre: "Monys Glam", estado: "ACTIVO", objetivo_principal: "Vender maquillaje" }],
    publicaciones: [{ cliente_agencia_id: "monys", created_at: "2026-11-01", productos: [{ nombre: "Base real" }], canales: ["INSTAGRAM"] }],
  });

  assert.equal(plan.length, 7);
  assert.equal(plan[0].fecha, "2026-11-04");
  assert.equal(plan[0].producto, "Base real");
  assert.match(plan[3].instruccion, /sin inventar ofertas/i);
});

test("marca el producto como pendiente cuando no existe evidencia", () => {
  const plan = generarPlanSemanalContenido({
    fechaBase: new Date(2026, 10, 4),
    clientes: [{ id: "cliente", nombre: "Cliente nuevo", estado: "ACTIVO" }],
  });

  assert.equal(plan[0].producto, "Producto por confirmar");
  assert.equal(plan[0].productoConfirmado, false);
  assert.equal(plan[0].estado, "FALTA_DATO");
});

test("reconoce una publicación ya agendada para el día, cliente y canal", () => {
  const plan = generarPlanSemanalContenido({
    fechaBase: new Date(2026, 10, 4),
    clientes: [{ id: "monys", nombre: "Monys Glam", estado: "ACTIVO" }],
    publicaciones: [{ id: "pub", cliente_agencia_id: "monys", created_at: "2026-11-01", productos: [{ nombre: "Labial" }], canales: ["INSTAGRAM"], programada_para: "2026-11-04T18:00:00" }],
  });

  assert.equal(plan[0].estado, "AGENDADO");
  assert.equal(plan[0].publicacionId, "pub");
});
