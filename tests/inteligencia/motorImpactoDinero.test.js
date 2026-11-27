import test from "node:test";
import assert from "node:assert/strict";
import {
  ESTADOS_IMPACTO,
  calcularImpactoCampana,
  calcularImpactoCompra,
  calcularImpactoPagoDeuda,
  calcularImpactoTraspaso,
  priorizarAcciones,
  resumirImpacto,
  resumirMargenesPorProducto,
} from "../../src/core/impacto/motorImpactoDinero.js";

// Traspaso base: destino sin stock, origen con stock de sobra y sin venta.
const traspasoBase = {
  cantidad: 10,
  utilidadUnitaria: 80,
  costoUnitario: 120,
  ventaDiariaDestino: 1,
  existenciaDestino: 0,
  ventaDiariaOrigen: 0,
  existenciaOrigen: 50,
  diasHorizonte: 14,
};

/* ---------- Márgenes (observación 1) ---------- */

test("resume margen por producto con totales de SICAR", () => {
  const margenes = resumirMargenesPorProducto([
    { codigo: "0012", cantidad: 2, importe: 400, utilidad: 160 },
    { codigo: "0012 ", cantidad: 3, importe: 600, utilidad: 240 },
    { codigo: "", cantidad: 5, importe: 100, utilidad: 50 },
  ]);
  const producto = margenes.get("codigo:0012");
  assert.equal(producto.piezas, 5);
  assert.equal(producto.precioPromedio, 200);
  assert.equal(producto.utilidadUnitaria, 80);
  assert.equal(producto.costoUnitario, 120);
  assert.equal(producto.margen, 0.4);
  assert.equal(producto.coberturaUtilidad, 1);
  assert.equal(margenes.size, 1);
});

test("utilidad parcial no se reparte entre todas las piezas", () => {
  const producto = resumirMargenesPorProducto([
    { codigo: "A", cantidad: 2, importe: 200, utilidad: 80 },
    { codigo: "A", cantidad: 8, importe: 800, utilidad: null },
  ]).get("codigo:a");
  assert.equal(producto.utilidadUnitaria, null);
  assert.equal(producto.coberturaUtilidad, 0.2);
  assert.equal(producto.precioPromedio, 100);
});

test("utilidad cero con venta es dudosa salvo que el importador la confirme", () => {
  const dudosa = resumirMargenesPorProducto([{ codigo: "A", cantidad: 4, importe: 400, utilidad: 0 }]).get("codigo:a");
  assert.equal(dudosa.utilidadUnitaria, null);
  const confirmada = resumirMargenesPorProducto([
    { codigo: "A", cantidad: 4, importe: 400, utilidad: 0, utilidadDisponible: true },
  ]).get("codigo:a");
  assert.equal(confirmada.utilidadUnitaria, 0);
});

/* ---------- Traspaso (observación 2) ---------- */

test("traspaso: venta nueva en destino y ahorro solo con compra evitada", () => {
  const sinCompra = calcularImpactoTraspaso({ ...traspasoBase, costoTraslado: 60 });
  assert.equal(sinCompra.estado, ESTADOS_IMPACTO.ESTIMADO);
  assert.equal(sinCompra.ventaNuevaDestino, 10);
  assert.equal(sinCompra.ganancia, 10 * 80 - 60);
  assert.equal(sinCompra.ahorro, null);
  assert.ok(sinCompra.faltantes.some((texto) => texto.includes("plan de compra")));

  const conCompra = calcularImpactoTraspaso({ ...traspasoBase, compraEvitada: true });
  assert.equal(conCompra.ahorro, 1200);
});

test("traspaso descuenta la existencia que ya tiene el destino", () => {
  // Destino vende 14 en el horizonte y ya tiene 10 → solo 4 ventas nuevas.
  const impacto = calcularImpactoTraspaso({ ...traspasoBase, existenciaDestino: 10 });
  assert.equal(impacto.ventaNuevaDestino, 4);
  assert.equal(impacto.ganancia, 4 * 80);
});

test("traspaso descuenta la venta que pierde el origen", () => {
  // Origen vende 1 diaria (14) y le quedan 12 → pierde 2 ventas.
  const impacto = calcularImpactoTraspaso({ ...traspasoBase, ventaDiariaOrigen: 1, existenciaOrigen: 22 });
  assert.equal(impacto.ventaPerdidaOrigen, 2);
  assert.equal(impacto.ganancia, (10 - 2) * 80);
});

test("traspaso que no paga su traslado no conviene", () => {
  const impacto = calcularImpactoTraspaso({ ...traspasoBase, cantidad: 2, utilidadUnitaria: 20, costoTraslado: 100 });
  assert.equal(impacto.estado, ESTADOS_IMPACTO.NO_CONVIENE);
  assert.equal(impacto.ganancia, -60);
});

test("traspaso sin utilidad ni existencias no inventa ceros", () => {
  const impacto = calcularImpactoTraspaso({ cantidad: 5, ventaDiariaDestino: 1 });
  assert.equal(impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS);
  assert.equal(impacto.ganancia, null);
  assert.ok(impacto.faltantes.some((texto) => texto.includes("utilidad")));
  assert.ok(impacto.faltantes.some((texto) => texto.includes("existencia de la sucursal destino")));
});

/* ---------- Validación de entradas (observación 3) ---------- */

test("rechaza negativos, booleanos, espacios, decimales y horizonte inválido", () => {
  const casos = [
    { cantidad: -3 },
    { cantidad: 2.5 },
    { cantidad: true },
    { cantidad: "   " },
    { utilidadUnitaria: true },
    { ventaDiariaDestino: -1 },
    { diasHorizonte: 0 },
    { diasHorizonte: "abc" },
    { cantidad: 60 }, // más piezas que la existencia del origen
  ];
  for (const caso of casos) {
    const impacto = calcularImpactoTraspaso({ ...traspasoBase, ...caso });
    assert.equal(impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS, JSON.stringify(caso));
  }
});

test("costo de traslado inválido no se convierte en cero", () => {
  for (const costoTraslado of [-50, "abc", true]) {
    const impacto = calcularImpactoTraspaso({ ...traspasoBase, costoTraslado });
    assert.equal(impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS, String(costoTraslado));
    assert.ok(impacto.faltantes.some((texto) => texto.includes("traslado")));
  }
  // Texto numérico con espacios sí es válido.
  assert.equal(calcularImpactoTraspaso({ ...traspasoBase, costoTraslado: " 40 " }).ganancia, 10 * 80 - 40);
});

/* ---------- Compra y recuperación (observación 4) ---------- */

test("compra de temporada descuenta la pérdida de lo que sobra", () => {
  const impacto = calcularImpactoCompra({
    unidades: 100, costoUnitario: 50, precioVenta: 120, ventaDiariaEstimada: 2, diasTemporada: 30, capitalDisponible: 10000,
  });
  // 60 vendidas × 120 + 40 sobrantes × 25 de remate − 5000 de inversión
  assert.equal(impacto.ganancia, 60 * 120 + 40 * 25 - 5000);
  assert.equal(impacto.inversion, 5000);
  assert.equal(impacto.unidadesRecomendadas, 60);
  assert.equal(impacto.estado, ESTADOS_IMPACTO.ESTIMADO);
  assert.equal(impacto.recuperacion, "en_temporada");
  assert.equal(impacto.diasRecuperacion, Math.ceil(5000 / 240));
  assert.ok(impacto.supuestos.some((texto) => texto.includes("supuesto: mitad del costo")));
});

test("recuperación no excede la temporada: con remate o no recuperable", () => {
  // Vende 10 × 60 = 600 en temporada; invierte 2000; remata 30 × 50 = 1500.
  const conRemate = calcularImpactoCompra({
    unidades: 40, costoUnitario: 50, precioVenta: 60, ventaDiariaEstimada: 1, diasTemporada: 10, valorRemateUnitario: 50, capitalDisponible: 5000,
  });
  assert.equal(conRemate.recuperacion, "con_remate");
  assert.equal(conRemate.diasRecuperacion, 10);

  const sinRecuperar = calcularImpactoCompra({
    unidades: 40, costoUnitario: 50, precioVenta: 60, ventaDiariaEstimada: 1, diasTemporada: 10, valorRemateUnitario: 0, capitalDisponible: 5000,
  });
  assert.equal(sinRecuperar.recuperacion, "no_recuperable");
  assert.equal(sinRecuperar.diasRecuperacion, null);
  assert.equal(sinRecuperar.estado, ESTADOS_IMPACTO.NO_CONVIENE);
});

test("compra sin liquidez confirmada queda pendiente, no autorizada", () => {
  const base = { unidades: 10, costoUnitario: 50, precioVenta: 120, ventaDiariaEstimada: 1, diasTemporada: 30 };
  assert.equal(calcularImpactoCompra(base).estado, ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ);
  assert.equal(calcularImpactoCompra({ ...base, capitalDisponible: 100 }).estado, ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ);
  assert.equal(calcularImpactoCompra({ ...base, capitalDisponible: -5 }).estado, ESTADOS_IMPACTO.FALTAN_DATOS);
  assert.equal(calcularImpactoCompra({ ...base, unidades: 3.5 }).estado, ESTADOS_IMPACTO.FALTAN_DATOS);
});

/* ---------- Campaña y deuda ---------- */

test("campaña calcula utilidad y ROAS de equilibrio", () => {
  const impacto = calcularImpactoCampana({ presupuesto: 1000, margenBruto: 0.4, ventasConCampana: 9000, ventasSinCampana: 5000 });
  assert.equal(impacto.ganancia, 4000 * 0.4 - 1000);
  assert.equal(impacto.roasEquilibrio, 2.5);
  assert.equal(impacto.roasEstimado, 4);
  const mala = calcularImpactoCampana({ presupuesto: 1000, margenBruto: 0.4, ventasAdicionalesEstimadas: 2000 });
  assert.equal(mala.estado, ESTADOS_IMPACTO.NO_CONVIENE);
});

test("pago anticipado de deuda calcula interés ahorrado", () => {
  const impacto = calcularImpactoPagoDeuda({ saldo: 50000, monto: 20000, tasaAnual: 0.6, diasAnticipo: 30, cargoEvitado: 350 });
  assert.equal(impacto.ahorro, Math.round((20000 * 0.6 * 30 / 365 + 350) * 100) / 100);
});

/* ---------- Priorización y resumen (observación 5) ---------- */

test("prioriza por estado y dinero", () => {
  const acciones = [
    { id: "a", impacto: calcularImpactoTraspaso({ cantidad: 5, ventaDiariaDestino: 1 }) },
    { id: "b", impacto: calcularImpactoTraspaso({ ...traspasoBase, cantidad: 5, utilidadUnitaria: 50 }) },
    { id: "c", impacto: calcularImpactoTraspaso({ ...traspasoBase, cantidad: 5, utilidadUnitaria: 90 }) },
    { id: "d", impacto: calcularImpactoPagoDeuda({ saldo: 1000, monto: 1000, tasaAnual: 0.365, diasAnticipo: 10 }) },
  ];
  assert.deepEqual(priorizarAcciones(acciones).map((accion) => accion.id), ["c", "b", "d", "a"]);
  const resumen = resumirImpacto(acciones);
  assert.equal(resumen.ganancia, 450 + 250 + 10);
  assert.equal(resumen.ahorro, null); // ningún traspaso confirmó compra evitada
  assert.equal(resumen.accionesListas, 3);
  assert.equal(resumen.accionesPendientes, 1);
  assert.deepEqual(resumen.cobertura, { calculables: 3, total: 4 });
});

test("sin acciones calculables el resumen no muestra cero confirmado", () => {
  const vacio = resumirImpacto([]);
  assert.equal(vacio.ganancia, null);
  assert.equal(vacio.ahorro, null);
  assert.deepEqual(vacio.cobertura, { calculables: 0, total: 0 });

  const soloFaltantes = resumirImpacto([{ id: "x", impacto: calcularImpactoTraspaso({ cantidad: 5 }) }]);
  assert.equal(soloFaltantes.ganancia, null);
  assert.deepEqual(soloFaltantes.cobertura, { calculables: 0, total: 1 });
});

test("escenarios excluyentes: misma mercancía a dos destinos suma solo la mejor", () => {
  const resumen = resumirImpacto([
    { id: "a-b", grupoExclusivo: "L1:A", impacto: calcularImpactoTraspaso({ ...traspasoBase, utilidadUnitaria: 80, compraEvitada: true }) },
    { id: "a-c", grupoExclusivo: "L1:A", impacto: calcularImpactoTraspaso({ ...traspasoBase, utilidadUnitaria: 50, compraEvitada: true }) },
  ]);
  assert.equal(resumen.ganancia, 800);
  assert.equal(resumen.ahorro, 1200);
  assert.equal(resumen.accionesSumadas, 1);
  assert.equal(resumen.accionesExcluidasPorEscenario, 1);
});

/* ---------- Segunda revisión de ChatGPT/Codex ---------- */

test("banderas de disponibilidad en false prevalecen sobre el número", () => {
  const margen = resumirMargenesPorProducto([
    { codigo: "A", cantidad: 2, importe: 200, utilidad: 80, utilidadDisponible: false },
    { codigo: "B", cantidad: 2, importe: 200, importeDisponible: false, utilidad: 80 },
  ]);
  assert.equal(margen.get("codigo:a").utilidadUnitaria, null);
  assert.equal(margen.get("codigo:b").precioPromedio, null);
  assert.equal(margen.get("codigo:b").utilidadUnitaria, 40);
});

test("cero sin importe tampoco es cero confirmado", () => {
  const margen = resumirMargenesPorProducto([{ codigo: "A", cantidad: 2, importe: 0, utilidad: 0 }]).get("codigo:a");
  assert.equal(margen.utilidadUnitaria, null);
  assert.equal(margen.precioPromedio, null);
});

test("venta perdida en origen solo cuenta lo que quita el traspaso", () => {
  // Origen: stock 10, demanda 20 (ya le faltan 10). Traspasa 3 → pierde 3, no 13.
  const impacto = calcularImpactoTraspaso({ ...traspasoBase, cantidad: 3, existenciaOrigen: 10, ventaDiariaOrigen: 20 / 14 });
  assert.equal(impacto.ventaPerdidaOrigen, 3);
  // Origen negativo es inventario por revisar, no se calcula.
  assert.equal(calcularImpactoTraspaso({ ...traspasoBase, existenciaOrigen: -4 }).estado, ESTADOS_IMPACTO.FALTAN_DATOS);
});

test("usa el margen de cada sucursal: venta nueva al del destino, perdida al del origen", () => {
  const impacto = calcularImpactoTraspaso({
    ...traspasoBase, existenciaOrigen: 22, ventaDiariaOrigen: 1, utilidadUnitaria: 80, utilidadUnitariaOrigen: 50,
  });
  assert.equal(impacto.ganancia, 10 * 80 - 2 * 50);
});

test("costo de traslado desconocido se declara, no se presenta como gratis", () => {
  const impacto = calcularImpactoTraspaso(traspasoBase);
  assert.equal(impacto.costoTrasladoConfirmado, false);
  assert.ok(impacto.faltantes.some((texto) => texto.includes("costo del traslado")));
  assert.ok(impacto.supuestos.some((texto) => texto.includes("no capturado")));
  assert.equal(calcularImpactoTraspaso({ ...traspasoBase, costoTraslado: 0 }).costoTrasladoConfirmado, true);
});

test("compra evitada se limita a las unidades del plan de compra", () => {
  const impacto = calcularImpactoTraspaso({ ...traspasoBase, compraEvitada: true, unidadesCompraEvitada: 4 });
  assert.equal(impacto.unidadesCompraEvitada, 4);
  assert.equal(impacto.ahorro, 4 * 120);
});

test("cargo evitado inválido en deuda no se vuelve cero", () => {
  const impacto = calcularImpactoPagoDeuda({ saldo: 1000, monto: 500, tasaAnual: 0.5, diasAnticipo: 30, cargoEvitado: -10 });
  assert.equal(impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS);
});
