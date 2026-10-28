import test from "node:test";
import assert from "node:assert/strict";
import { detectarReporte } from "../../src/features/importador/utils/detectorReportes.js";
import { normalizarAbonosProveedores } from "../../src/features/importador/utils/normalizador.js";
import { cruzarAbonosConMovimientosSicar, detectarPosiblesDuplicadosAbono, resumirAbonosProveedores } from "../../src/features/importador/utils/conciliarAbonosProveedorSicar.js";

const pago = (fecha, folio, metodo, total) => {
  const fila = Array(28).fill("");
  Object.assign(fila, { 0: fecha, 2: "Caja 1", 4: "admin", 6: folio, 7: metodo, 27: total });
  return fila;
};
const proveedor = (nombre, representante) => {
  const fila = Array(28).fill("");
  Object.assign(fila, { 0: "Proveedor:", 2: nombre, 12: "Representante:", 15: representante });
  return fila;
};
const encabezados = Array(28).fill("");
Object.assign(encabezados, { 0: "Fecha", 2: "Caja", 4: "Usuario", 6: "Folio C.", 7: "FP", 9: "MultiPago", 14: "Referencia", 27: "Total" });
const filas = [
  encabezados,
  pago(46314.700914351735, "fg10111083r9-", "CH", "$ 30,000.00"),
  proveedor("PINK UP", "FASHION GIRL"),
  pago(46314.70292824088, "369", "CH", "$ 30,000.00"),
  proveedor("JESSI MOIRA", "JESSI MOIRA"),
  pago(46315.48017361108, "-", "EF", "$ 1,170.00"),
  proveedor("NEKANE", "NEKANE"),
];

test("detecta el reporte SICAR de abonos por separado de movimientos de caja", () => {
  assert.equal(detectarReporte(filas[0]), "Abonos de proveedores");
});

test("normaliza pagos, método y proveedor de las filas complementarias del reporte", () => {
  const abonos = normalizarAbonosProveedores(filas);
  assert.equal(abonos.length, 3);
  assert.deepEqual(abonos.map(({ proveedorNombre, metodoPago, monto }) => [proveedorNombre, metodoPago, monto]), [
    ["PINK UP", "CH", 30000],
    ["JESSI MOIRA", "CH", 30000],
    ["NEKANE", "EF", 1170],
  ]);
  assert.equal(abonos[0].representante, "FASHION GIRL");
  assert.equal(abonos[0].fecha, "2026-10-19");
  assert.equal(abonos[0].hora, "16:49:19");
});

test("solo propone vínculo cuando fecha, hora, caja, forma e importe coinciden en una fila", () => {
  const abonos = normalizarAbonosProveedores(filas);
  const detalles = [{
    id: "detalle-pink",
    importacion_id: "importacion-movimientos",
    datos_originales: {
      fecha: 46314.700914351735,
      hora: 46314.700914351735,
      caja: "Caja 1",
      metodoPago: "CH",
      tipoMovimiento: "SALIDA",
      monto: 30000,
    },
  }];
  const cruzados = cruzarAbonosConMovimientosSicar(abonos, detalles);
  assert.equal(cruzados[0].estadoCruce, "COINCIDENCIA_UNICA");
  assert.equal(cruzados[0].coincidencias[0].id, "detalle-pink");
  assert.equal(cruzados[1].estadoCruce, "SIN_COINCIDENCIA");
  assert.equal(cruzados[2].estadoCruce, "SIN_COINCIDENCIA");
  assert.equal(cruzarAbonosConMovimientosSicar([abonos[0]], [detalles[0], { ...detalles[0], id: "otra-fila" }])[0].estadoCruce, "AMBIGUA");
});

test("resume abonos sin redondeo monetario incorrecto", () => {
  const resumen = resumirAbonosProveedores([
    { proveedorNombre: "Nekane", metodoPago: "CH", monto: 1812.75 },
    { proveedorNombre: "Nekane", metodoPago: "EF", monto: 1170 },
  ]);
  assert.equal(resumen.cantidad, 2);
  assert.equal(resumen.total, 2982.75);
  assert.deepEqual(resumen.porProveedor, [{ nombre: "Nekane", total: 2982.75 }]);
});

test("marca como posible duplicado un movimiento del mismo día, importe y proveedor sin confirmarlo", () => {
  const abono = normalizarAbonosProveedores(filas)[0];
  const [resultado] = detectarPosiblesDuplicadosAbono([abono], [
    { id: "caja-importada", movement_type: "SALIDA", amount: 30000, occurred_at: "2026-10-19T16:49:19Z", concept: "Movimiento de caja sin comentario", counterparty: "admin" },
    { id: "posible-duplicado", movement_type: "SALIDA", amount: 30000, occurred_at: "2026-10-19T18:00:00Z", concept: "Abono a nota Pink - inventario", counterparty: "Pink" },
  ]);
  assert.deepEqual(resultado.posiblesDuplicados.map((fila) => fila.id), ["posible-duplicado"]);
});

test("marca con cautela las tres salidas ya anotadas para Pink, Jessi y Rubén", () => {
  const abonos = [
    { proveedorNombre: "PINK UP", fecha: "2026-10-19", monto: 30000 },
    { proveedorNombre: "JESSI MOIRA", fecha: "2026-10-19", monto: 30000 },
    { proveedorNombre: "RUBEN BEAUTY", fecha: "2026-10-19", monto: 20000 },
  ];
  const movimientos = [
    { id: "pink", movement_type: "SALIDA", amount: 30000, occurred_at: "2026-10-19T18:00:00Z", concept: "Abono a nota Pink" },
    { id: "jessi", movement_type: "SALIDA", amount: 30000, occurred_at: "2026-10-19T18:05:00Z", concept: "Abono a notas vencidas - proveedor Jessy" },
    { id: "ruben", movement_type: "SALIDA", amount: 20000, occurred_at: "2026-10-19T18:10:00Z", concept: "Abono a notas vencidas - proveedor Rubén" },
  ];
  const resultado = detectarPosiblesDuplicadosAbono(abonos, movimientos);
  assert.deepEqual(resultado.map((abono) => abono.posiblesDuplicados.map((fila) => fila.id)), [
    ["pink"], ["jessi"], ["ruben"],
  ]);
});
