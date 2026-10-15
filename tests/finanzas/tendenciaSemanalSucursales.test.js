import test from "node:test";
import assert from "node:assert/strict";
import {
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
