import test from "node:test";
import assert from "node:assert/strict";
import { prepararImpactoDineroHoy } from "../../src/features/dashboard/utils/accionesImpactoDinero.js";
import { calcularImpactoTraspaso } from "../../src/core/impacto/motorImpactoDinero.js";

const base = { cantidad: 4, ventaDiariaDestino: 1, existenciaDestino: 0, ventaDiariaOrigen: 0, existenciaOrigen: 20 };

function recomendacion(codigo, impactoDinero, destino = "B") {
  return {
    codigo,
    producto: `Producto ${codigo}`,
    cantidadSugerida: 4,
    branchOrigenId: "A",
    branchDestinoId: destino,
    sucursalOrigen: "Centro",
    sucursalDestino: destino === "B" ? "Nueva" : "Otra",
    impactoDinero,
  };
}

test("ordena traspasos por ganancia, oculta los que no convienen y no suma alternativas", () => {
  const datos = prepararImpactoDineroHoy({
    recomendacionesTraspaso: [
      recomendacion("BAJA", calcularImpactoTraspaso({ ...base, utilidadUnitaria: 10, costoUnitario: 20, compraEvitada: true })),
      recomendacion("ALTA", calcularImpactoTraspaso({ ...base, utilidadUnitaria: 90, costoUnitario: 60, compraEvitada: true })),
      recomendacion("ALTA", calcularImpactoTraspaso({ ...base, utilidadUnitaria: 70, costoUnitario: 60, compraEvitada: true }), "C"),
      recomendacion("PIERDE", calcularImpactoTraspaso({ ...base, utilidadUnitaria: 5, costoTraslado: 200 })),
      recomendacion("SINDATO", calcularImpactoTraspaso({ ...base })),
      { codigo: "VIEJA", cantidadSugerida: 2 },
    ],
  });

  assert.deepEqual(
    datos.principales.map((accion) => accion.id),
    ["traspaso:ALTA:A:B", "traspaso:ALTA:A:C", "traspaso:BAJA:A:B", "traspaso:SINDATO:A:B"]
  );
  // ALTA hacia B y hacia C son la misma mercancía: solo se suma la mejor.
  assert.equal(datos.resumen.ganancia, 360 + 40);
  assert.equal(datos.resumen.ahorro, 240 + 80);
  assert.equal(datos.resumen.accionesExcluidasPorEscenario, 1);
  assert.equal(datos.totalAcciones, 4);
});

test("sin sugerencias calculables no muestra cero", () => {
  const datos = prepararImpactoDineroHoy({ recomendacionesTraspaso: [] });
  assert.equal(datos.resumen.ganancia, null);
  assert.equal(datos.totalAcciones, 0);
});
