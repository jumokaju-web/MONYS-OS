import test from "node:test";
import assert from "node:assert/strict";

import {
  crearPendienteExistenciaDestino,
} from "../../src/features/inventario/shared/pendienteExistenciaDestino.js";

test("una existencia destino ausente queda pendiente y nunca se convierte en cero ni en traspaso", () => {
  const pendiente = crearPendienteExistenciaDestino({
    codigo: "SKU-1",
    producto: "Producto con venta observada",
    existenciaOrigen: 12,
    ventasDestino: 3,
  });

  assert.equal(pendiente.existenciaDestino, null);
  assert.equal(pendiente.cantidadSugerida, null);
  assert.equal(pendiente.prioridad, "PENDIENTE");
  assert.equal(pendiente.estado, "PENDIENTE_EXISTENCIA_DESTINO");
  assert.equal(pendiente.existenciaOrigen, 12);
  assert.equal(pendiente.ventasDestino, 3);
});
