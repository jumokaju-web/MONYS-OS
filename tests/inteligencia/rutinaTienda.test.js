import test from "node:test";
import assert from "node:assert/strict";

import { construirRutinaInteligente, tareasPendientesDeRutina } from "../../src/features/inteligencia/shared/rutinaTienda.js";

const empleados = [
  { id: "v1", nombre: "Ana López", usuario_id: "auth-ana", responsabilidades: ["VENTA_TIENDA"] },
  { id: "v2", nombre: "Karla Ruiz", usuario_id: "auth-karla", responsabilidades: ["VENTA_TIENDA"] },
  { id: "m1", nombre: "Majo", usuario_id: "auth-majo", responsabilidades: ["INVENTARIO_APOYO"] },
  { id: "w1", nombre: "Luz", usuario_id: "auth-luz", responsabilidades: ["VENTA_WHATSAPP"] },
];

const configuraciones = [
  { empleado_id: "v1", nombre_preferido: "Ani", dia_descanso: 1, area_asignada: "VENTA_TIENDA", turno_asignado: "PRIMERO" },
  { empleado_id: "v2", nombre_preferido: "Karla", dia_descanso: 4, area_asignada: "VENTA_TIENDA", turno_asignado: "SEGUNDO" },
  { empleado_id: "m1", nombre_preferido: "Majo", dia_descanso: 5, area_asignada: "INVENTARIO_APOYO", turno_asignado: "PRIMERO" },
  { empleado_id: "w1", nombre_preferido: "Luz", dia_descanso: 0, area_asignada: "VENTA_WHATSAPP", turno_asignado: "AMBOS" },
];

test("respeta descansos y turno; reparte muebles, limpieza y conteo SICAR", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-12", // Lunes: Ana descansa.
    empleados,
    configuraciones,
    productosCriticos: [
      { codigo: "P-1", descripcion: "Crema rosa", existencia: 2, nivelInventario: "CRITICO" },
    ],
    fuenteInventario: { fecha: "2026-10-11" },
  });

  assert.equal(resultado.empleadosDisponibles, 3);
  assert.equal(resultado.tareas.filter((tarea) => tarea.titulo === "Limpiar su mueble y exhibidor").length, 1);
  assert.equal(resultado.tareas.some((tarea) => tarea.responsable === "Ani"), false);
  assert.equal(resultado.tareas.find((tarea) => tarea.titulo.includes("primer turno")), undefined);
  assert.equal(resultado.tareas.find((tarea) => tarea.titulo.includes("segundo turno")).responsable, "Karla");
  assert.equal(resultado.tareas.find((tarea) => tarea.titulo.includes("bodega")).responsable, "Majo");
  assert.ok(resultado.tareas.find((tarea) => tarea.titulo.includes("bodega")).instrucciones.includes("Crema rosa"));
  assert.ok(resultado.avisos.some((aviso) => aviso.includes("primer turno")));
});

test("no inventa conteo de bodega sin SICAR y omite perfiles faltantes", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados,
    configuraciones: configuraciones.slice(0, 2),
    productosCriticos: [{ codigo: "P-1", existencia: 0, nivelInventario: "CRITICO" }],
  });

  assert.equal(resultado.tareas.some((tarea) => tarea.titulo.includes("bodega")), false);
  assert.ok(resultado.avisos.some((aviso) => aviso.includes("falta un reporte SICAR")));
  assert.ok(resultado.avisos.some((aviso) => aviso.includes("no completa su perfil")));
});

test("rota el baño y no duplica tareas ya preparadas", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados,
    configuraciones,
    historial: [
      { titulo: "Lavar y revisar el baño", responsable: "Karla" },
      { titulo: "Lavar y revisar el baño", responsable: "Karla" },
      { titulo: "Lavar y revisar el baño", responsable: "Majo" },
    ],
  });
  const bano = resultado.tareas.find((tarea) => tarea.titulo.includes("baño"));
  assert.equal(bano.responsable, "Ani");
  assert.equal(tareasPendientesDeRutina(resultado.tareas, [bano]).some((tarea) => tarea.titulo === bano.titulo && tarea.responsable === bano.responsable), false);
});

test("un perfil con varias áreas participa en tienda y en inventario", () => {
  const perfilesMultiples = configuraciones.map((configuracion) => configuracion.empleado_id === "v2"
    ? { ...configuracion, areas_asignadas: ["VENTA_TIENDA", "INVENTARIO_APOYO"] }
    : configuracion);
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados: empleados.filter((empleado) => empleado.id !== "m1"),
    configuraciones: perfilesMultiples,
    productosCriticos: [{ codigo: "P-2", descripcion: "Producto urgente", existencia: 1, nivelInventario: "CRITICO" }],
    fuenteInventario: { fecha: "2026-10-12" },
  });

  assert.ok(resultado.tareas.some((tarea) => tarea.titulo === "Limpiar su mueble y exhibidor" && tarea.responsable === "Karla"));
  assert.ok(resultado.tareas.some((tarea) => tarea.titulo.includes("bodega") && tarea.responsable === "Karla"));
});

test("rechaza fecha inválida", () => {
  assert.throws(() => construirRutinaInteligente({ fecha: "2026-02-30" }), /fecha válida/i);
});
