import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_INGRESO,
  CATEGORIAS_SIN_IMPACTO_EN_UTILIDAD,
  permiteNoAplica,
  validarMovimientoParaRevision,
} from "../../src/features/tesoreria/utils/validacionMovimientoTesoreria.js";

const migracion = readFileSync(
  new URL("../../supabase/migrations/20261128010000_categorias_deuda_impuestos_marketplace.sql", import.meta.url),
  "utf8"
);

test("la lista de la app coincide con la función de la base de datos", () => {
  const cuerpo = migracion.slice(migracion.indexOf("in ("), migracion.indexOf(");\n$$;"));
  const enSql = [...cuerpo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual([...CATEGORIAS_SIN_IMPACTO_EN_UTILIDAD].sort(), enSql);
});

test("capital, IVA, ISR y operaciones de marketplace pueden marcarse como no gasto", () => {
  for (const categoria of ["pago_capital_deuda", "impuesto_iva", "impuesto_isr", "liquidacion_marketplace", "retencion_marketplace", "devolucion_marketplace"]) {
    assert.equal(permiteNoAplica(categoria), true, categoria);
    assert.equal(validarMovimientoParaRevision({ movement_type: "SALIDA", expense_category: categoria, expense_behavior: "no_aplica" }).valido, true);
  }
});

test("intereses, IMSS y comisiones de marketplace son gasto: no aceptan 'no aplica'", () => {
  for (const categoria of ["intereses_deuda", "cuotas_imss_infonavit", "comisiones_marketplace"]) {
    assert.equal(permiteNoAplica(categoria), false, categoria);
    assert.equal(validarMovimientoParaRevision({ movement_type: "SALIDA", expense_category: categoria, expense_behavior: "no_aplica" }).valido, false);
    assert.equal(validarMovimientoParaRevision({ movement_type: "SALIDA", expense_category: categoria, expense_behavior: "fijo" }).valido, true);
  }
});

test("las categorías nuevas aparecen en la lista de captura y no se repiten", () => {
  const valores = CATEGORIAS_GASTO.map(([valor]) => valor);
  assert.equal(new Set(valores).size, valores.length);
  for (const nueva of ["intereses_deuda", "pago_capital_deuda", "impuesto_iva", "impuesto_isr", "cuotas_imss_infonavit", "comisiones_marketplace", "retencion_marketplace", "devolucion_marketplace"]) {
    assert.ok(valores.includes(nueva), nueva);
  }
  assert.ok(CATEGORIAS_INGRESO.some(([valor]) => valor === "liquidacion_marketplace"));
  assert.ok(!CATEGORIAS_INGRESO.some(([valor]) => valor.startsWith("venta_")));
});

test("la migración es aditiva: no reclasifica ni borra movimientos", () => {
  // Fuera de los cuerpos de función ($$ … $$), que son los vigentes copiados.
  const sentencias = migracion.replace(/\$\$[\s\S]*?\$\$/g, "");
  assert.doesNotMatch(sentencias, /^\s*(update|delete)\s/im);
  assert.doesNotMatch(migracion, /drop\s+table|disable row level security/i);
  assert.match(migracion, /like '%anticipo_prestamo%'/);
});
