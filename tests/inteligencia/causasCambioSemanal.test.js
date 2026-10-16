import test from "node:test";
import assert from "node:assert/strict";
import { analizarCausasCambioSemanal } from "../../src/features/inteligencia/utils/causasCambioSemanal.js";
import { normalizarVentasPorArticulo } from "../../src/features/importador/utils/normalizador.js";

const reporte = (id, branchId, inicio, fin, detalles) => ({
  importacion: { id, branch_id: branchId, archivo_original: `${id}.xlsx`, created_at: `${fin}T12:00:00Z` },
  periodo: { fechaInicio: inicio, fechaFin: fin },
  detalles: detalles.map((fila) => ({ codigo: fila.codigo, descripcion: fila.descripcion, cantidad: fila.cantidad, datos_originales: fila })),
});

test("descompone venta por unidades y precio, utilidad y costo implícito, sin atribuir causalidad", () => {
  const resultado = analizarCausasCambioSemanal({
    reportes: [
      reporte("base", "centro", "2026-10-01", "2026-10-07", [{ codigo: "A", descripcion: "Crema", cantidad: 2, importe: 180, utilidad: 80, cantidadDisponible: true, importeDisponible: true, utilidadDisponible: true }]),
      reporte("actual", "centro", "2026-10-08", "2026-10-14", [{ codigo: "A", descripcion: "Crema", cantidad: 3, importe: 300, utilidad: 120, cantidadDisponible: true, importeDisponible: true, utilidadDisponible: true }]),
    ],
    nombresSucursal: { centro: "Centro" },
  });
  const producto = resultado.comparaciones[0];
  assert.equal(producto.cambioVenta, 120);
  assert.equal(producto.efectoCantidad, 95);
  assert.equal(producto.efectoPrecio, 25);
  assert.equal(producto.cambioUtilidad, 40);
  assert.equal(producto.cambioCostoImplicito, 80);
  assert.equal(Math.round(producto.cambioMargenPuntos * 100) / 100, -4.44);
  assert.match(resultado.notaCausalidad, /no demuestran causalidad/);
  assert.equal(resultado.acciones[0].requiereAutorizacion, true);
  assert.equal(resultado.acciones[0].fechaRevision, null);
});

test("separa stock con demanda y stock sin movimiento en el último corte, sin inferir obsolescencia", () => {
  const filas = [
    { codigo: "A", descripcion: "Crema", cantidad: 2, importe: 100, utilidad: 40, cantidadDisponible: true, importeDisponible: true, utilidadDisponible: true },
    { codigo: "B", descripcion: "Brocha", cantidad: 0, importe: 0, utilidad: 0, cantidadDisponible: true, importeDisponible: true, utilidadDisponible: true },
  ];
  const resultado = analizarCausasCambioSemanal({
    reportes: [
      reporte("base", "centro", "2026-10-01", "2026-10-07", filas),
      reporte("actual", "centro", "2026-10-08", "2026-10-14", [
        { ...filas[0], cantidad: 4, importe: 220, utilidad: 90 },
        filas[1],
      ]),
    ],
    inventarios: [{ branch_id: "centro", importacion: { created_at: "2026-10-15T12:00:00Z", archivo_original: "stock.xlsx" }, detalles: [
      { codigo: "A", cantidad: 0, datos_originales: { codigo: "A", descripcion: "Crema", existencia: 0 } },
      { codigo: "B", cantidad: 6, datos_originales: { codigo: "B", descripcion: "Brocha", existencia: 6 } },
    ] }],
    nombresSucursal: { centro: "Centro" },
  });
  assert.ok(resultado.acciones.some((accion) => accion.tipo === "demanda_stock_bajo" && accion.producto === "Crema"));
  const sinMovimiento = resultado.acciones.find((accion) => accion.tipo === "stock_sin_movimiento");
  assert.equal(sinMovimiento.producto, "Brocha");
  assert.match(sinMovimiento.resumen, /no acredita obsolescencia/);
});

test("bloquea periodos de distinta duración y fechas imposibles", () => {
  const resultado = analizarCausasCambioSemanal({ reportes: [
    reporte("base", "centro", "2026-10-01", "2026-10-07", []),
    reporte("actual", "centro", "2026-10-08", "2026-10-15", []),
    reporte("fecha-invalida", "centro", "2026-02-30", "2026-03-08", []),
  ] });
  assert.equal(resultado.comparaciones.length, 0);
  assert.equal(resultado.estado, "PENDIENTE");
  assert.equal(resultado.reportesSinPeriodo.length, 1);
});

test("no convierte importes ausentes ni utilidades heredadas ambiguas en cero", () => {
  const encabezados = ["Código", "Descripción", "Cantidad"];
  const fila = ["A", "Producto A", 4];
  const normalizado = normalizarVentasPorArticulo([encabezados, fila])[0];
  assert.equal(normalizado.cantidadDisponible, true);
  assert.equal(normalizado.importeDisponible, false);
  assert.equal(normalizado.utilidadDisponible, false);
  const resultado = analizarCausasCambioSemanal({ reportes: [
    reporte("base", "centro", "2026-10-01", "2026-10-07", [{ ...normalizado, utilidadDisponible: true, utilidad: 0 }]),
    reporte("actual", "centro", "2026-10-08", "2026-10-14", [{ ...normalizado, importeDisponible: false, utilidadDisponible: true, utilidad: 10 }]),
  ] });
  assert.equal(resultado.comparaciones[0].cambioVenta, null);
  assert.equal(resultado.comparaciones[0].cambioUtilidad, 10);
  assert.ok(resultado.pendientes.some((pendiente) => pendiente.faltan.includes("importe disponible en ambos reportes")));
  assert.ok(resultado.acciones.some((accion) => accion.tipo === "utilidad_arriba"));
});

test("solo compara Centro y General Anaya cuando ambos reportan exactamente el mismo corte", () => {
  const detalle = [{ codigo: "A", descripcion: "Producto", cantidad: 1, importe: 10, utilidad: 4, cantidadDisponible: true, importeDisponible: true, utilidadDisponible: true }];
  const resultado = analizarCausasCambioSemanal({
    reportes: [
      reporte("c1", "c", "2026-10-01", "2026-10-07", detalle),
      reporte("c2", "c", "2026-10-08", "2026-10-14", detalle),
      reporte("a1", "a", "2026-10-01", "2026-10-07", detalle),
      reporte("a2", "a", "2026-10-08", "2026-10-14", [{ ...detalle[0], importe: 15 }]),
    ],
    nombresSucursal: { c: "Centro", a: "General Anaya" },
  });
  assert.equal(resultado.sucursalesMismoPeriodo.length, 1);
  assert.equal(resultado.diferenciasSucursal.length, 1);
  assert.equal(resultado.diferenciasSucursal[0].diferenciaVenta, -5);
});
