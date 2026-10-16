import test from "node:test";
import assert from "node:assert/strict";
import {
  construirLecturaEjecutiva,
  construirMetaRecuperacion,
  construirTendenciaSemanal,
  resumirImportacionUtilidad,
  seleccionarCandidatosCampana,
} from "../../src/features/inteligencia/utils/tendenciaSemanalSucursales.js";

function semana({ id, branchId, nombre, inicio, fin, ventas, costo, utilidad, recibidoAt }) {
  return resumirImportacionUtilidad({
    importacion: { id, branch_id: branchId, created_at: recibidoAt },
    sucursal: { id: branchId, nombre },
    detalles: [{
      datos_originales: {
        periodoInicio: inicio,
        periodoFin: fin,
        ventaTotal: ventas,
        costoTotal: costo,
        utilidad,
      },
    }],
  });
}

test("conserva semanas por sucursal, elimina duplicados y calcula la variación", () => {
  const primera = semana({ id: "a1", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-05", fin: "2026-10-11", ventas: 100, costo: 60, utilidad: 40, recibidoAt: "2026-10-12T10:00:00Z" });
  const duplicadaVieja = semana({ id: "a0", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-05", fin: "2026-10-11", ventas: 90, costo: 55, utilidad: 35, recibidoAt: "2026-10-12T09:00:00Z" });
  const segunda = semana({ id: "a2", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-12", fin: "2026-10-18", ventas: 110, costo: 65, utilidad: 45, recibidoAt: "2026-10-19T10:00:00Z" });
  const centro = semana({ id: "c1", branchId: "centro", nombre: "Centro", inicio: "2026-10-05", fin: "2026-10-11", ventas: 400, costo: 250, utilidad: 150, recibidoAt: "2026-10-12T10:00:00Z" });

  const tendencia = construirTendenciaSemanal([segunda, primera, duplicadaVieja, centro]);

  assert.equal(tendencia.semanas.length, 3);
  assert.equal(tendencia.periodos.length, 2);
  assert.equal(tendencia.semanas.find((item) => item.id === "a1").ventas, 100);
  assert.equal(tendencia.semanas.find((item) => item.id === "a2").variacionVentas, 10);
  assert.equal(Number(tendencia.semanas.find((item) => item.id === "a2").variacionUtilidad.toFixed(2)), 12.5);
  assert.equal(Number(tendencia.semanas.find((item) => item.id === "a2").variacionMargenPuntos.toFixed(2)), 0.91);
});

test("no compara cortes con distinta duración", () => {
  const semanaCompleta = semana({ id: "a1", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-01", fin: "2026-10-07", ventas: 100, costo: 60, utilidad: 40 });
  const corteParcial = semana({ id: "a2", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-08", fin: "2026-10-10", ventas: 80, costo: 50, utilidad: 30 });
  const tendencia = construirTendenciaSemanal([semanaCompleta, corteParcial]);
  const ultima = tendencia.semanas.find((item) => item.id === "a2");

  assert.equal(ultima.periodoAnteriorComparable, false);
  assert.equal(ultima.variacionVentas, null);
  assert.equal(ultima.variacionUtilidad, null);
});

test("la lectura ejecutiva distingue crecimiento rentable y deterioro", () => {
  const anaya1 = semana({ id: "a1", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-01", fin: "2026-10-07", ventas: 100, costo: 60, utilidad: 40 });
  const anaya2 = semana({ id: "a2", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-08", fin: "2026-10-14", ventas: 120, costo: 70, utilidad: 50 });
  const centro1 = semana({ id: "c1", branchId: "centro", nombre: "Centro", inicio: "2026-10-01", fin: "2026-10-07", ventas: 500, costo: 300, utilidad: 200 });
  const centro2 = semana({ id: "c2", branchId: "centro", nombre: "Centro", inicio: "2026-10-08", fin: "2026-10-14", ventas: 450, costo: 290, utilidad: 160 });
  const lectura = construirLecturaEjecutiva(construirTendenciaSemanal([anaya1, anaya2, centro1, centro2]));

  assert.equal(lectura.comparacionMismoCorte, true);
  assert.equal(lectura.sucursales.find((item) => item.branchId === "anaya").lectura.estado, "crece");
  assert.equal(lectura.sucursales.find((item) => item.branchId === "centro").lectura.estado, "riesgo");
});

test("una métrica financiera ausente permanece pendiente y no se convierte en cero", () => {
  const resultado = resumirImportacionUtilidad({
    importacion: { id: "x", created_at: "2026-10-15T10:00:00Z" },
    sucursal: { id: "centro", nombre: "Centro" },
    detalles: [{ datos_originales: { periodoInicio: "2026-10-01", periodoFin: "2026-10-07", costoTotal: 90 } }],
  });

  assert.equal(resultado.ventas, null);
  assert.equal(resultado.utilidadBruta, null);
  assert.equal(resultado.costo, 90);
  assert.equal(resultado.margen, null);
});

test("la primera meta de rescate aumenta 10% sin fingir que ya igualó a Centro", () => {
  const base = semana({ id: "a1", branchId: "anaya", nombre: "General Anaya", inicio: "2026-10-05", fin: "2026-10-11", ventas: 29525.89, costo: 17430.04, utilidad: 12095.85 });
  const meta = construirMetaRecuperacion([base], "General Anaya", 10);

  assert.equal(Number(meta.objetivo.toFixed(2)), 32478.48);
  assert.equal(Number(meta.brecha.toFixed(2)), 2952.59);
  assert.equal(meta.dias, 7);
});

test("los candidatos de campaña requieren stock, precio y utilidad positivos", () => {
  const candidatos = seleccionarCandidatosCampana([
    { datos_originales: { codigo: "A", descripcion: "Producto rentable", existencia: 10, precioVenta: 100, precioCompra: 50, utilidadUnitaria: 50 } },
    { datos_originales: { codigo: "B", descripcion: "Sin stock", existencia: 0, precioVenta: 200, precioCompra: 50, utilidadUnitaria: 150 } },
    { datos_originales: { codigo: "C", descripcion: "Margen saludable", existencia: 8, precioVenta: 80, precioCompra: 50, utilidadUnitaria: 30 } },
    { datos_originales: { codigo: "D", descripcion: "Mayoreo de impulso", existencia: 5000, precioVenta: 5, precioCompra: 1, utilidadUnitaria: 4 } },
  ], 3);

  assert.deepEqual(candidatos.map((producto) => producto.codigo), ["A", "C"]);
  assert.equal(candidatos[0].margen, 50);
});
