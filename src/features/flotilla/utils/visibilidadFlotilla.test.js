import assert from "node:assert/strict";
import test from "node:test";
import { obtenerVisibilidadFlotilla } from "./visibilidadFlotilla.js";

test("el chofer solo ve su operación, pago y movimientos propios", () => {
  assert.deepEqual(obtenerVisibilidadFlotilla({ role: "empleado" }), {
    esAdministrador: false,
    esSocioConsulta: false,
    esChofer: true,
    puedeVerPropietario: false,
    puedeCapturarLiquidacionAdministrativa: false,
    puedeVerResultadoNegocio: false,
    puedeVerMovimientosPropios: true,
  });
});

test("Mónica y Chory conservan la administración completa de flotilla", () => {
  for (const entrada of [
    { role: "owner" },
    { role: "empleado", tipoAcceso: "ADMIN_FLOTILLA" },
  ]) {
    const visibilidad = obtenerVisibilidadFlotilla(entrada);
    assert.equal(visibilidad.esAdministrador, true);
    assert.equal(visibilidad.puedeVerPropietario, true);
    assert.equal(visibilidad.puedeCapturarLiquidacionAdministrativa, true);
    assert.equal(visibilidad.puedeVerResultadoNegocio, true);
    assert.equal(visibilidad.puedeVerMovimientosPropios, false);
  }
});

test("el socio consulta sus unidades sin poder capturar liquidaciones", () => {
  const visibilidad = obtenerVisibilidadFlotilla({
    role: "empleado",
    tipoAcceso: "SOCIO_CONSULTA",
  });

  assert.equal(visibilidad.esSocioConsulta, true);
  assert.equal(visibilidad.puedeVerPropietario, true);
  assert.equal(visibilidad.puedeCapturarLiquidacionAdministrativa, false);
  assert.equal(visibilidad.puedeVerResultadoNegocio, false);
  assert.equal(visibilidad.puedeVerMovimientosPropios, false);
});
