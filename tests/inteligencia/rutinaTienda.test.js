import test from "node:test";
import assert from "node:assert/strict";

import { construirRutinaInteligente, priorizarProductosParaConteo, tareasPendientesDeRutina } from "../../src/features/inteligencia/shared/rutinaTienda.js";

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
  assert.equal(resultado.tareas.some((tarea) => tarea.responsable === "Ana López"), false);
  assert.equal(resultado.tareas.find((tarea) => tarea.titulo.includes("primer turno")), undefined);
  assert.equal(resultado.tareas.find((tarea) => tarea.titulo.includes("segundo turno")).responsable, "Karla Ruiz");
  assert.equal(resultado.tareas.find((tarea) => tarea.titulo.includes("lote 1 de 1")).responsable, "Luz");
  assert.ok(resultado.tareas.find((tarea) => tarea.titulo.includes("lote 1 de 1")).instrucciones.includes("Crema rosa"));
  assert.ok(resultado.avisos.some((aviso) => aviso.includes("primer turno")));
});

test("no inventa conteo de bodega sin SICAR y omite perfiles faltantes", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados,
    configuraciones: configuraciones.slice(0, 2),
    productosCriticos: [{ codigo: "P-1", existencia: 0, nivelInventario: "CRITICO" }],
  });

  assert.equal(resultado.tareas.some((tarea) => tarea.titulo.includes("lote")), false);
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
  assert.ok(["Ana López", "Luz"].includes(bano.responsable));
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
    productosCriticos: Array.from({ length: 31 }, (_, index) => ({ codigo: `P-${index + 2}`, descripcion: "Producto urgente", existencia: 1, nivelInventario: "CRITICO" })),
    fuenteInventario: { fecha: "2026-10-12" },
  });

  assert.ok(resultado.tareas.some((tarea) => tarea.titulo === "Limpiar su mueble y exhibidor" && tarea.responsable === "Karla Ruiz"));
  assert.ok(resultado.tareas.some((tarea) => tarea.titulo.includes("lote") && tarea.responsable === "Karla Ruiz"));
});

test("las tareas se dirigen al ID de autenticación aunque RH guarde el ID del perfil", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados: [{ ...empleados[0], usuario_id: "perfil-monys-ana", auth_user_id: "auth-ana" }],
    configuraciones: [configuraciones[0]],
  });
  const tareaMueble = resultado.tareas.find((tarea) => tarea.titulo === "Limpiar su mueble y exhibidor");
  assert.equal(tareaMueble.responsableUsuarioId, "auth-ana");
});

test("reparte lotes de 30 a todo el personal programado y prioriza negativos", () => {
  const productos = Array.from({ length: 75 }, (_, index) => ({
    codigo: `P-${index + 1}`,
    descripcion: `Producto ${index + 1}`,
    existencia: index === 45 ? -2 : 5,
    piezasVendidas: 10,
    ventaDiaria: 1,
    diasCobertura: 5,
    nivelInventario: index === 45 ? "NEGATIVO" : "CRITICO",
  }));
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados,
    configuraciones,
    productosCriticos: priorizarProductosParaConteo(productos),
    fuenteInventario: { fecha: "2026-10-12" },
  });
  const lotes = resultado.tareas.filter((tarea) => tarea.titulo.includes("lote"));
  assert.deepEqual(lotes.map((tarea) => tarea.responsable), ["Karla Ruiz", "Majo", "Luz"]);
  assert.deepEqual(lotes.map((tarea) => (tarea.instrucciones.match(/^• /gm) || []).length), [30, 30, 15]);
  assert.ok(lotes[0].instrucciones.includes("P-46")); // existencia negativa sube al primer lote
  assert.equal(resultado.productosAsignados, 75);
  assert.equal(resultado.avisos.some((aviso) => aviso.includes("restantes")), false);
});

test("limita el conteo a 30 productos por persona y avisa lo que queda pendiente", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados,
    configuraciones,
    productosCriticos: Array.from({ length: 150 }, (_, index) => ({ codigo: `X${index}`, existencia: -1, nivelInventario: "NEGATIVO" })),
    fuenteInventario: { fecha: "2026-10-12" },
  });
  const lotes = resultado.tareas.filter((tarea) => tarea.titulo.includes("lote"));
  assert.equal(lotes.length, 4); // solo 4 personas tienen perfil completo y no descansan el martes
  assert.ok(lotes.every((tarea) => (tarea.instrucciones.match(/^• /gm) || []).length <= 30));
  assert.equal(resultado.productosAsignados, 120);
  assert.ok(resultado.avisos.some((aviso) => aviso.includes("120 de 150")));
});

test("para hoy asigna solo a quien registró entrada y sigue respetando descanso", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados,
    configuraciones,
    asistenciaRegistrada: [{ empleado_id: "v2" }],
    productosCriticos: [{ codigo: "PRESENTE", existencia: -1, nivelInventario: "NEGATIVO" }],
    fuenteInventario: { fecha: "2026-10-12" },
  });
  assert.deepEqual(resultado.personasProgramadas, ["Karla Ruiz"]);
  assert.equal(resultado.tareas.every((tarea) => tarea.responsable === "Karla Ruiz"), true);

  const sinEntrada = construirRutinaInteligente({
    fecha: "2026-10-13",
    empleados,
    configuraciones,
    asistenciaRegistrada: [],
    productosCriticos: [{ codigo: "PRESENTE", existencia: -1, nivelInventario: "NEGATIVO" }],
    fuenteInventario: { fecha: "2026-10-12" },
  });
  assert.equal(sinEntrada.tareas.length, 0);
  assert.ok(sinEntrada.avisos.some((aviso) => aviso.includes("registró entrada")));
});

test("muestra Dirección quién está presente, quién no registró y quién descansa", () => {
  const resultado = construirRutinaInteligente({
    fecha: "2026-10-12", // Lunes: Ana descansa.
    empleados: [...empleados, { id: "sin-perfil", nombre: "Vale", responsabilidades: ["VENTA_TIENDA"] }],
    configuraciones,
    asistenciaRegistrada: [{ empleado_id: "v2", entrada_at: "2026-10-12T15:10:00.000Z" }],
  });
  const equipo = new Map(resultado.equipo.map((persona) => [persona.empleadoId, persona]));

  assert.equal(equipo.get("v1").estado, "DESCANSA");
  assert.equal(equipo.get("v2").estado, "PRESENTE");
  assert.equal(equipo.get("v2").nombre, "Karla");
  assert.equal(equipo.get("v2").turno, "SEGUNDO");
  assert.equal(equipo.get("w1").estado, "SIN_ENTRADA");
  assert.equal(equipo.get("sin-perfil").estado, "PERFIL_PENDIENTE");
});

test("rechaza fecha inválida", () => {
  assert.throws(() => construirRutinaInteligente({ fecha: "2026-02-30" }), /fecha válida/i);
});
