import { resolverResponsabilidadesEmpleado } from "./responsabilidadesEmpleado.js";

function weekday(fecha) {
  return new Date(`${fecha}T12:00:00`).getDay();
}

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))) return false;
  const parsed = new Date(`${fecha}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === fecha;
}

function llaveTarea(texto) {
  return String(texto || "").trim().toLocaleLowerCase("es-MX");
}

function elegirConMenorCarga(candidatos, historial, fecha, perfiles = new Map()) {
  if (!candidatos.length) return null;
  const cargas = new Map(candidatos.map((empleado) => [String(empleado.id), 0]));
  for (const tarea of historial) {
    const id = tarea?.responsable_empleado_id || tarea?.empleado_id || tarea?.responsable_usuario_id || null;
    const nombre = llaveTarea(tarea?.responsable);
    const empleado = candidatos.find((item) =>
      (id && [item.id, item.usuario_id].some((value) => value && String(value) === String(id))) ||
      llaveTarea(item.nombre) === nombre ||
      llaveTarea(perfiles.get(String(item.id))?.nombre_preferido) === nombre,
    );
    if (empleado && cargas.has(String(empleado.id))) {
      cargas.set(String(empleado.id), cargas.get(String(empleado.id)) + 1);
    }
  }
  const minimo = Math.min(...cargas.values());
  const empatados = candidatos.filter((empleado) => cargas.get(String(empleado.id)) === minimo);
  const semilla = Number(fecha.replaceAll("-", "")) || 0;
  return empatados[semilla % empatados.length];
}

function crearTarea({ fecha, empleado, configuracion, titulo, descripcion, instrucciones, criterioExito, prioridad = "normal" }) {
  return {
    fecha,
    area: "tienda",
    titulo,
    descripcion,
    instrucciones,
    criterioExito,
    prioridad,
    responsable: configuracion?.nombre_preferido || empleado.nombre || "Equipo de tienda",
    responsableUsuarioId: empleado.usuario_id || null,
    requiereEvidencia: false,
  };
}

function esVendedoraTienda(empleado, configuracion) {
  return configuracion?.area_asignada === "VENTA_TIENDA" &&
    resolverResponsabilidadesEmpleado(empleado).includes("VENTA_TIENDA");
}

function coincideTurno(configuracion, turno) {
  return configuracion?.turno_asignado === turno || configuracion?.turno_asignado === "AMBOS";
}

export function construirRutinaInteligente({
  fecha,
  empleados = [],
  configuraciones = [],
  historial = [],
  productosCriticos = [],
  fuenteInventario = null,
} = {}) {
  if (!fechaValida(fecha)) throw new Error("Selecciona una fecha válida para la rutina.");

  const lista = Array.isArray(empleados) ? empleados : [];
  const perfiles = new Map((Array.isArray(configuraciones) ? configuraciones : [])
    .map((item) => [String(item.empleado_id), item]));
  const trabajoPrevio = Array.isArray(historial) ? historial : [];
  const inventarioCritico = Array.isArray(productosCriticos) ? productosCriticos : [];
  const asignacionesHoy = [];
  const dia = weekday(fecha);
  const avisos = [];
  const disponibles = lista.filter((empleado) => {
    const config = perfiles.get(String(empleado.id));
    if (!config) return false;
    return Number(config.dia_descanso) !== dia;
  });
  const personalTienda = disponibles.filter((empleado) =>
    esVendedoraTienda(empleado, perfiles.get(String(empleado.id))),
  );
  const tareas = [];

  const sinPerfil = lista.filter((empleado) => !perfiles.has(String(empleado.id)));
  if (sinPerfil.length) {
    avisos.push(`${sinPerfil.length} empleada${sinPerfil.length === 1 ? "" : "s"} aún no completa su perfil; no se le asignaron rutinas automáticamente.`);
  }
  if (!personalTienda.length) {
    avisos.push("No hay vendedoras de tienda disponibles con perfil y responsabilidades configurados para esta fecha.");
  }

  for (const empleado of personalTienda) {
    const configuracion = perfiles.get(String(empleado.id));
    tareas.push(crearTarea({
      fecha,
      empleado,
      configuracion,
      titulo: "Limpiar su mueble y exhibidor",
      descripcion: "Mantener limpio y ordenado el mueble asignado a la vendedora.",
      instrucciones: "Limpia y ordena tu mueble y exhibidor. Acomoda los productos en su lugar y reporta cualquier producto dañado o faltante.",
      criterioExito: "Mueble y exhibidor asignados limpios, ordenados y con faltantes reportados.",
    }));
  }

  const candidatosTurno = (turno) => personalTienda.filter((empleado) =>
    coincideTurno(perfiles.get(String(empleado.id)), turno),
  );
  const barrer = [
    { turno: "PRIMERO", titulo: "Barrer y trapear al iniciar el primer turno" },
    { turno: "SEGUNDO", titulo: "Barrer y trapear al iniciar el segundo turno" },
  ];
  for (const item of barrer) {
    const responsable = elegirConMenorCarga(candidatosTurno(item.turno), [...trabajoPrevio, ...asignacionesHoy], fecha, perfiles);
    if (!responsable) {
      avisos.push(`No hay una persona disponible configurada para el ${item.turno === "PRIMERO" ? "primer" : "segundo"} turno; esa limpieza quedó sin asignar.`);
      continue;
    }
    tareas.push(crearTarea({
      fecha,
      empleado: responsable,
      configuracion: perfiles.get(String(responsable.id)),
      titulo: item.titulo,
      descripcion: "Dejar las áreas de venta limpias al inicio del turno.",
      instrucciones: "Barre y trapea las áreas de venta al iniciar tu turno. Señaliza el piso mientras esté húmedo.",
      criterioExito: "Piso de las áreas de venta barrido y trapeado con seguridad.",
    }));
    asignacionesHoy.push({ responsable: perfiles.get(String(responsable.id))?.nombre_preferido || responsable.nombre });
  }

  const responsablesComunes = personalTienda;
  const responsableBano = elegirConMenorCarga(
    responsablesComunes,
    [...trabajoPrevio, ...asignacionesHoy],
    fecha,
    perfiles,
  );
  if (responsableBano) {
    tareas.push(crearTarea({
      fecha,
      empleado: responsableBano,
      configuracion: perfiles.get(String(responsableBano.id)),
      titulo: "Lavar y revisar el baño",
      descripcion: "Dejar el baño limpio y reportar faltantes o reparaciones.",
      instrucciones: "Lava y revisa el baño. Si falta jabón, papel u otro insumo, repórtalo en las observaciones antes de terminar.",
      criterioExito: "Baño limpio; faltantes o reparaciones reportados.",
    }));
    asignacionesHoy.push({ responsable: perfiles.get(String(responsableBano.id))?.nombre_preferido || responsableBano.nombre });
  } else {
    avisos.push("El baño quedó sin responsable porque no hay personal de tienda disponible.");
  }

  if (!fuenteInventario?.fecha) {
    avisos.push("No se creó conteo de bodega: falta un reporte SICAR con productos críticos identificados.");
  } else if (inventarioCritico.length === 0) {
    avisos.push("El último reporte SICAR no detectó productos críticos o bajos; no se generó conteo de bodega.");
  } else {
    const candidatosBodega = disponibles.filter((empleado) =>
      perfiles.get(String(empleado.id))?.area_asignada === "INVENTARIO_APOYO" ||
      resolverResponsabilidadesEmpleado(empleado).includes("INVENTARIO_APOYO"),
    );
    const responsable = elegirConMenorCarga(candidatosBodega, [...trabajoPrevio, ...asignacionesHoy], fecha, perfiles);
    if (!responsable) {
      avisos.push("Hay productos SICAR que necesitan conteo, pero no hay una persona disponible con responsabilidad de inventario.");
    } else {
      const listaProductos = inventarioCritico.map((producto) =>
        `• ${producto.codigo || "Sin código"} · ${producto.descripcion || "Producto"} · SICAR: ${producto.existencia} · ${producto.nivelInventario || "REVISAR"}`,
      );
      tareas.push(crearTarea({
        fecha,
        empleado: responsable,
        configuracion: perfiles.get(String(responsable.id)),
        titulo: "Contar productos críticos de bodega",
        descripcion: `Validar físicamente ${inventarioCritico.length} producto${inventarioCritico.length === 1 ? "" : "s"} detectado${inventarioCritico.length === 1 ? "" : "s"} en el último reporte SICAR.`,
        instrucciones: [
          `Fuente SICAR: ${fuenteInventario.fecha}${fuenteInventario.nombre ? ` · ${fuenteInventario.nombre}` : ""}.`,
          "Cuenta la existencia física de cada producto y registra el resultado en MONYS. No cambies el inventario en SICAR; reporta diferencias a Dirección.",
          ...listaProductos,
        ].join("\n"),
        criterioExito: "Existencia física registrada para los productos de la lista; diferencias reportadas a Dirección.",
        prioridad: "alta",
      }));
    }
  }

  return { tareas, avisos, empleadosDisponibles: disponibles.length };
}

export function tareasPendientesDeRutina(tareas, existentes = []) {
  const listaExistente = Array.isArray(existentes) ? existentes : [];
  return (Array.isArray(tareas) ? tareas : []).filter((tarea) => !listaExistente.some((actual) =>
    llaveTarea(actual.titulo) === llaveTarea(tarea.titulo) &&
    llaveTarea(actual.area) === llaveTarea(tarea.area) &&
    llaveTarea(actual.responsable) === llaveTarea(tarea.responsable),
  ));
}
