import test from "node:test";
import assert from "node:assert/strict";

import {
  limpiarResponsabilidadesEmpleado,
  resolverAreasPerfilEmpleado,
  resolverResponsabilidadesEmpleado,
} from "../../src/features/inteligencia/shared/responsabilidadesEmpleado.js";

test("conserva varias responsabilidades válidas sin duplicarlas", () => {
  assert.deepEqual(
    limpiarResponsabilidadesEmpleado([
      "venta_tienda",
      "VENTA_WHATSAPP",
      "VENTA_TIENDA",
      "NO_EXISTE",
    ]),
    ["VENTA_TIENDA", "VENTA_WHATSAPP"],
  );
});

test("una vendedora antigua conserva venta en tienda por compatibilidad", () => {
  assert.deepEqual(
    resolverResponsabilidadesEmpleado({ puesto: "Vendedora", responsabilidades: [] }),
    ["VENTA_TIENDA"],
  );
});

test("una encargada antigua recibe solo responsabilidades operativas seguras", () => {
  assert.deepEqual(
    resolverResponsabilidadesEmpleado({ puesto: "Encargada" }),
    ["VENTA_TIENDA", "CAJA_CORTE", "INVENTARIO_APOYO"],
  );
});

test("respeta la selección explícita de WhatsApp sin agregar tienda", () => {
  assert.deepEqual(
    resolverResponsabilidadesEmpleado({
      puesto: "Vendedora",
      responsabilidades: ["VENTA_WHATSAPP", "PUBLICAR_GRUPOS_WHATSAPP"],
    }),
    ["VENTA_WHATSAPP", "PUBLICAR_GRUPOS_WHATSAPP"],
  );
});

test("precarga en el perfil operativo las áreas ya asignadas desde RH", () => {
  assert.deepEqual(
    resolverAreasPerfilEmpleado({
      puesto: "Ventas",
      responsabilidades: ["VENTA_TIENDA", "CAJA_CORTE", "INVENTARIO_APOYO"],
    }),
    ["VENTA_TIENDA", "CAJA_CORTE", "INVENTARIO_APOYO"],
  );
});

test("conserva todas las áreas iniciales y el orden definido en RH", () => {
  assert.deepEqual(
    resolverAreasPerfilEmpleado({
      responsabilidades: [
        "VENTA_TIENDA",
        "VENTA_WHATSAPP",
        "PUBLICAR_GRUPOS_WHATSAPP",
        "CAJA_CORTE",
      ],
    }),
    ["VENTA_TIENDA", "VENTA_WHATSAPP", "PUBLICAR_GRUPOS_WHATSAPP", "CAJA_CORTE"],
  );
});
