import test from "node:test";
import assert from "node:assert/strict";
import {
  areasSugeridasParaEmpleado,
  resumirEquipoOperativo,
} from "../../src/features/inteligencia/shared/equipoOperativo.js";

test("resume perfiles listos y accesos faltantes sin contar personal inactivo", () => {
  const empleados = [
    { id: "1", active: true, auth_user_id: "u1" },
    { id: "2", active: true, auth_user_id: null },
    { id: "3", active: false, auth_user_id: null },
  ];
  const resumen = resumirEquipoOperativo(empleados, [{ empleado_id: "1" }]);
  assert.deepEqual(resumen, { activos: 2, listos: 1, pendientes: 1, sinAcceso: 1, completo: false });
});

test("sugiere áreas desde responsabilidades y limita el perfil a tres", () => {
  const areas = areasSugeridasParaEmpleado({
    puesto: "Vendedora",
    responsabilidades: ["VENTA_TIENDA", "CAJA_CORTE", "INVENTARIO_APOYO", "VENTA_WHATSAPP"],
  });
  assert.deepEqual(areas, ["VENTA_TIENDA", "CAJA_CORTE", "INVENTARIO_APOYO"]);
});

test("sugiere un inicio prudente según el puesto cuando faltan responsabilidades", () => {
  assert.deepEqual(areasSugeridasParaEmpleado({ puesto: "Marketing" }), ["PUBLICAR_GRUPOS_WHATSAPP", "VENTA_WHATSAPP"]);
  assert.deepEqual(areasSugeridasParaEmpleado({ puesto: "Vendedora" }), ["VENTA_TIENDA"]);
  assert.deepEqual(areasSugeridasParaEmpleado({ puesto: "Administración" }), []);
});
