import test from "node:test";
import assert from "node:assert/strict";
import { accionesDelDiaAContrato, normalizarRecomendaciones, prioridadesDeHoy, urgenciasDeEquilibrio } from "../../src/core/finanzas/recomendacionesHoy.js";

// Sintético: forma de las salidas de #171 y #163.
const estado = {
  mes: "2026-10", confianza: "media",
  faltantes: ["Plaza: 2 día(s) sin carga de SICAR", "Centro: 1 renglón(es) sin utilidad"],
  unidades: [
    { unidad: "s1", nombre: "Centro", tipo: "sucursal", contribucionDevengado: 5000 },
    { unidad: "s2", nombre: "Plaza", tipo: "sucursal", contribucionDevengado: -1000, gastosDirectos: { pendiente: 10000 } },
  ],
};
const comparativo = {
  estadosPorMes: { "2026-10": estado },
  meses: [{ mes: "2026-10", vsMesAnterior: { unidades: [{ unidad: "s2", ingresos: { delta: -12000 } }] } }],
};
const recs = [
  { clave: "contribucion_negativa:s2", mes: "2026-10", titulo: "Plaza pierde dinero", impactoMensual: 1000, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "volumen:s2", mes: "2026-10", titulo: "Venta de Plaza bajó", impactoMensual: 4800, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "margen_bruto:s2", mes: "2026-10", titulo: "Margen de Plaza bajó", impactoMensual: 2000, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "pendiente:s2", mes: "2026-10", titulo: "Plaza: obligaciones sin pago", impactoMensual: null, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "gasto:NOMINA", mes: "2026-10", titulo: "Nómina subió", impactoMensual: 8000, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "intereses", mes: "2026-10", titulo: "Intereses", impactoMensual: null, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "clasificar", mes: "2026-10", titulo: "Sin clasificar", impactoMensual: null, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "cancelaciones:canal:ml1", mes: "2026-10", titulo: "Cancelaciones", impactoMensual: null, evidencia: "e", accion: "a", confianza: "media" },
  { clave: "contribucion_negativa:s1", mes: "2026-10", titulo: "Centro gana", impactoMensual: 300, evidencia: "e", accion: "a", confianza: "media" },
];
const equilibrio = {
  mesObjetivo: "2026-12",
  sucursales: [
    { unidad: "s2", nombre: "Plaza", mesBase: "2026-10", ventaDiariaActual: 1500, margenContribucionPct: 40, diasConVentaEsperada: 30, efectivo: { ventaDiaria: 2000, brechaDiaria: -500 }, faltantes: [], avisos: [] },
    { unidad: "s1", nombre: "Centro", mesBase: "2026-10", ventaDiariaActual: 4000, margenContribucionPct: 45, diasConVentaEsperada: 29, efectivo: { ventaDiaria: 3000, brechaDiaria: 1000 }, faltantes: [], avisos: [] },
  ],
};
const acciones163 = [
  { id: "traspaso:A:s1:s2", tipo: "traspaso", titulo: "Mover rímel a Plaza", grupoExclusivo: "traspaso:A:s1", impacto: { ganancia: 900, diasHorizonte: 30, estado: "ESTIMADO", faltantes: [] } },
  { id: "traspaso:A:s1:s3", tipo: "traspaso", titulo: "Mover rímel a Norte", grupoExclusivo: "traspaso:A:s1", alternativaDe: "traspaso:A:s1:s2", impacto: { ganancia: 600, diasHorizonte: 30 } },
  { id: "deuda:d1", tipo: "pago_deuda", titulo: "Abonar a tarjeta", impacto: { ganancia: 450, ahorro: 450, estado: "ESTIMADO" } },
];

function armar() {
  return prioridadesDeHoy([
    normalizarRecomendaciones({ businessId: "b", recomendaciones: recs, comparativo }),
    urgenciasDeEquilibrio({ businessId: "b", equilibrio }),
    accionesDelDiaAContrato({ businessId: "b", acciones: acciones163, hoy: "2026-11-28" }),
  ]);
}

test("contrato v2: id estable, tipo de impacto, importe, periodo, alcance, destino y faltantes", () => {
  const h = armar();
  const r = h.todas.find((x) => x.id === "rentabilidad:volumen:2026-10:s2");
  assert.equal(r.version, 2);
  assert.equal(r.tipoImpacto, "recuperacion_ventas");
  assert.deepEqual(r.impacto, { importe: 4800, medida: "utilidad_bruta", unidad: "MXN", periodo: { tipo: "mensual", mes: "2026-10" }, estado: "estimado", base: null });
  assert.equal(r.ventasAsociadas, 12000); // venta, aparte de la utilidad
  assert.deepEqual(r.alcance, { tipo: "sucursal", businessId: "b", branchId: "s2", cuentaId: null, canal: null, nombre: "Plaza" });
  assert.equal(r.accion.destino, "ventas/sucursal");
  assert.ok(r.faltantes.includes("Plaza: 2 día(s) sin carga de SICAR"));
  assert.ok(!r.faltantes.some((f) => f.startsWith("Centro")));
  assert.equal(r.requiereAutorizacion, true);
  // Mismo insumo, mismos ids.
  assert.deepEqual(armar().todas.map((x) => x.id), h.todas.map((x) => x.id));
  const canal = h.todas.find((x) => x.id === "rentabilidad:cancelaciones:2026-10:canal:ml1");
  assert.equal(canal.tipoImpacto, "riesgo");
  assert.equal(canal.impacto.importe, null);
  assert.equal(h.todas.find((x) => x.id.startsWith("rentabilidad:gasto:")).accion.parametros.categoria, "NOMINA");
});

test("alternativas incompatibles: mejoras de utilidad de la misma unidad no se suman", () => {
  const h = armar();
  const plaza = h.todas.filter((x) => x.grupoExclusivo === "utilidad:s2");
  assert.equal(plaza.length, 3);
  const principal = plaza.find((x) => !x.alternativaDe);
  assert.equal(principal.id, "rentabilidad:volumen:2026-10:s2");
  assert.ok(plaza.filter((x) => x.alternativaDe).every((x) => x.alternativaDe === principal.id && /no se suman/.test(x.motivoNoSumar)));
  // Alternativa de #163 conservada.
  assert.equal(h.todas.find((x) => x.id === "hoy:traspaso:A:s1:s3").alternativaDe, "hoy:traspaso:A:s1:s2");
  // Intereses: duplicado del abono de #163.
  assert.equal(h.todas.find((x) => x.id === "rentabilidad:intereses:2026-10:negocio").duplicadoDe, "hoy:deuda:d1");
});

test("vistas: liquidez aparte, 3 prioridades, categorías y totales sin mezclar medidas", () => {
  const h = armar();
  assert.deepEqual(h.urgenciasLiquidez.map((x) => x.id), ["rentabilidad:pendiente:2026-10:s2", "liquidez:efectivo:2026-12:s2"]);
  const urgencia = h.urgenciasLiquidez[1];
  assert.equal(urgencia.impacto.importe, 6000); // 500 × 30 × 40%
  assert.equal(urgencia.ventasAsociadas, 15000);
  assert.equal(urgencia.impacto.medida, "deficit_efectivo");
  assert.deepEqual(h.prioridades.map((x) => x.id), ["rentabilidad:gasto:2026-10:NOMINA", "rentabilidad:volumen:2026-10:s2", "hoy:traspaso:A:s1:s2"]);
  assert.ok(h.prioridades.every((x) => x.grupo === "oportunidad" && !x.alternativaDe));
  assert.deepEqual(h.calidadDatos.map((x) => x.id), ["rentabilidad:clasificar:2026-10:negocio"]);
  assert.ok(h.porCategoria.inventario.some((x) => x.id === "hoy:traspaso:A:s1:s2"));
  // Totales: utilidad bruta del mes solo de principales (volumen 4 800), sin el margen (2 000) ni la contribución (1 000).
  const ub = h.totales.find((t) => t.medida === "utilidad_bruta" && t.periodo.tipo === "mensual");
  assert.equal(ub.importe, 4800);
  // El traspaso (30 días) va en otro total; efectivo y gasto, separados.
  assert.ok(h.totales.some((t) => t.medida === "utilidad_bruta" && t.periodo.tipo === "dias" && t.importe === 900));
  assert.ok(h.totales.some((t) => t.medida === "deficit_efectivo" && t.grupo === "urgencia_liquidez"));
  assert.equal(new Set(h.totales.map((t) => `${t.grupo}|${t.medida}|${JSON.stringify(t.periodo)}`)).size, h.totales.length);
});

test("acciones de #163: traspaso con su sucursal destino y 'capturar tasas' como calidad de datos", () => {
  const [t, sinTasa] = accionesDelDiaAContrato({ businessId: "b", acciones: [
    { id: "traspaso:A:s1:s2", tipo: "traspaso", titulo: "Traspasar 3 rímel", detalle: "Centro → Plaza", impacto: { ganancia: 900 } },
    { id: "deuda:sin-tasa", tipo: "pago_deuda", titulo: "Capturar la tasa de 2 deuda(s)", impacto: { tipo: "pago_deuda" } },
  ] });
  assert.deepEqual([t.alcance.tipo, t.alcance.branchId, t.alcance.nombre], ["sucursal", "s2", "Centro → Plaza"]);
  assert.deepEqual([sinTasa.grupo, sinTasa.categoria, sinTasa.impacto.importe], ["calidad_datos", "datos", null]);
  const h = prioridadesDeHoy([[t, sinTasa]]);
  assert.ok(h.calidadDatos.some((x) => x.id === "hoy:deuda:sin-tasa"));
  assert.ok(!h.prioridades.some((x) => x.id === "hoy:deuda:sin-tasa"));
});
