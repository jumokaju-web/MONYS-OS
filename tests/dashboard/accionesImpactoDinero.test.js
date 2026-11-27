import test from "node:test";
import assert from "node:assert/strict";
import { prepararImpactoDineroHoy } from "../../src/features/dashboard/utils/accionesImpactoDinero.js";
import { calcularImpactoTraspaso } from "../../src/core/impacto/motorImpactoDinero.js";

function recomendacion(codigo, impactoDinero) {
  return {
    codigo,
    producto: `Producto ${codigo}`,
    cantidadSugerida: 4,
    branchOrigenId: "A",
    branchDestinoId: "B",
    sucursalOrigen: "Centro",
    sucursalDestino: "Nueva",
    impactoDinero,
  };
}

test("ordena traspasos por ganancia y oculta los que no convienen", () => {
  const datos = prepararImpactoDineroHoy({
    recomendacionesTraspaso: [
      recomendacion("BAJA", calcularImpactoTraspaso({ cantidad: 4, utilidadUnitaria: 10, costoUnitario: 20, ventaDiariaDestino: 1 })),
      recomendacion("ALTA", calcularImpactoTraspaso({ cantidad: 4, utilidadUnitaria: 90, costoUnitario: 60, ventaDiariaDestino: 1 })),
      recomendacion("PIERDE", calcularImpactoTraspaso({ cantidad: 4, utilidadUnitaria: 5, ventaDiariaDestino: 1, costoTraslado: 200 })),
      recomendacion("SINDATO", calcularImpactoTraspaso({ cantidad: 4, ventaDiariaDestino: 1 })),
      { codigo: "VIEJA", cantidadSugerida: 2 },
    ],
  });

  assert.deepEqual(datos.principales.map((accion) => accion.id.split(":")[1]), ["ALTA", "BAJA", "SINDATO"]);
  assert.equal(datos.principales[0].detalle, "Centro → Nueva");
  assert.equal(datos.resumen.ganancia, 360 + 40);
  assert.equal(datos.resumen.ahorro, 240 + 80);
  assert.equal(datos.totalAcciones, 3);
});
