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

function elegirConMenorCarga(candidatos, historial, fecha, perfiles = new Map(), { evitarRepetirHoy = false } = {}) {
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
  const yaAsignadosHoy = new Set((evitarRepetirHoy ? historial.filter((tarea) => tarea?.fecha === fecha) : [])
    .map((tarea) => llaveTarea(tarea?.responsable)));
  const candidatosSinCargaHoy = candidatos.filter((empleado) => !yaAsignadosHoy.has(llaveTarea(empleado.nombre)));
  const pool = candidatosSinCargaHoy.length ? candidatosSinCargaHoy : candidatos;
  const minimo = Math.min(...pool.map((empleado) => cargas.get(String(empleado.id))));
  const empatados = pool.filter((empleado) => cargas.get(String(empleado.id)) === minimo);
  const semilla = Number(fecha.replaceAll("-", "")) || 0;
  return empatados[semilla % empatados.length];
}

function crearTarea({ fecha, empleado, titulo, descripcion, instrucciones, criterioExito, prioridad = "normal", area = "tienda" }) {
  return {
    fecha,
    area,
    titulo,
    descripcion,
    instrucciones,
    criterioExito,
    prioridad,
    // tareas_operativas se filtra por el nombre de la ficha de empleada.
    responsable: empleado.nombre || "Equipo de tienda",
    responsableUsuarioId: empleado.usuario_id || null,
    requiereEvidencia: false,
  };
}

function esVendedoraTienda(empleado, configuracion) {
  const areas = Array.isArray(configuracion?.areas_asignadas) && configuracion.areas_asignadas.length
    ? configuracion.areas_asignadas
    : [configuracion?.area_asignada];
  return areas.includes("VENTA_TIENDA") &&
    resolverResponsabilidadesEmpleado(empleado).includes("VENTA_TIENDA");
}

function coincideTurno(configuracion, turno) {
  return configuracion?.turno_asignado === turno || configuracion?.turno_asignado === "AMBOS";
}

function ordenarPorMenorCarga(candidatos, historial, fecha) {
  if (!candidatos.length) return [];
  const cargas = new Map(candidatos.map((empleado) => [String(empleado.id), 0]));
  for (const tarea of historial) {
    const responsable = llaveTarea(tarea?.responsable);
    const empleado = candidatos.find((item) => llaveTarea(item.nombre) === responsable);
    if (empleado) cargas.set(String(empleado.id), cargas.get(String(empleado.id)) + 1);
  }
  const inicioRotacion = (Number(fecha.replaceAll("-", "")) || 0) % candidatos.length;
  const ordenRotacion = new Map(candidatos.map((empleado, index) => [String(empleado.id), (index - inicioRotacion + candidatos.length) % candidatos.length]));
  return [...candidatos].sort((a, b) =>
    cargas.get(String(a.id)) - cargas.get(String(b.id)) ||
    ordenRotacion.get(String(a.id)) - ordenRotacion.get(String(b.id)),
  );
}

export function construirRutinaInteligente({
  fecha,
  empleados = [],
  configuraciones = [],
  historial = [],
  productosCriticos = [],
  fuenteInventario = null,
  asistenciaRegistrada = null,
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
  const perfilesListos = lista.filter((empleado) => {
    const config = perfiles.get(String(empleado.id));
    if (!config) return false;
    return Number(config.dia_descanso) !== dia;
  });
  const idsPresentes = Array.isArray(asistenciaRegistrada)
    ? new Set(asistenciaRegistrada.map((item) => String(item?.empleado_id || item)))
    : null;
  const disponibles = perfilesListos.filter((empleado) =>
    idsPresentes === null || idsPresentes.has(String(empleado.id)),
  );
  const personalTienda = disponibles.filter((empleado) =>
    esVendedoraTienda(empleado, perfiles.get(String(empleado.id))),
  );
  const tareas = [];

  const sinPerfil = lista.filter((empleado) => !perfiles.has(String(empleado.id)));
  if (sinPerfil.length) {
    avisos.push(`${sinPerfil.length} empleada${sinPerfil.length === 1 ? "" : "s"} aún no completa su perfil; no se le asignaron rutinas automáticamente.`);
  }
  if (idsPresentes && !disponibles.length) {
    avisos.push("Nadie con perfil completo registró entrada en esta sucursal y fecha; no se asignaron tareas a personal solo programado.");
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
    asignacionesHoy.push({ responsable: responsable.nombre, fecha });
  }

  const responsablesComunes = disponibles;
  const historialBano = trabajoPrevio.filter((tarea) => /baño/i.test(tarea.titulo || ""));
  const responsableBano = elegirConMenorCarga(
    responsablesComunes,
    [...historialBano, ...asignacionesHoy],
    fecha,
    perfiles,
    { evitarRepetirHoy: true },
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
    asignacionesHoy.push({ responsable: responsableBano.nombre, fecha });
  } else {
    avisos.push("El baño quedó sin responsable porque no hay personal programado disponible con perfil completo.");
  }

  const historialBodega = trabajoPrevio.filter((tarea) => /ordenar y revisar bodega/i.test(tarea.titulo || ""));
  const responsableBodega = elegirConMenorCarga(
    disponibles,
    [...historialBodega, ...asignacionesHoy],
    fecha,
    perfiles,
    { evitarRepetirHoy: true },
  );
  if (responsableBodega) {
    tareas.push(crearTarea({
      fecha,
      empleado: responsableBodega,
      titulo: "Ordenar y revisar bodega",
      descripcion: "Dejar la bodega ordenada y reportar productos dañados, faltantes o sin etiqueta.",
      instrucciones: "Revisa pasillos y anaqueles, acomoda productos en su lugar y reporta diferencias, daños o faltantes. No ajustes SICAR ni autorices compras.",
      criterioExito: "Bodega ordenada y cualquier diferencia o daño reportado a Dirección.",
    }));
    asignacionesHoy.push({ responsable: responsableBodega.nombre, fecha });
  } else {
    avisos.push("La revisión de bodega quedó sin responsable porque no hay personal programado disponible con perfil completo.");
  }

  if (!fuenteInventario?.fecha) {
    avisos.push("No se creó conteo de bodega: falta un reporte SICAR con productos críticos identificados.");
  } else if (inventarioCritico.length === 0) {
    avisos.push("El último reporte SICAR no detectó productos críticos o bajos; no se generó conteo de bodega.");
  } else {
      const historialInventario = trabajoPrevio.filter((tarea) => /lote \d+ de \d+/i.test(tarea.titulo || ""));
      const elegiblesInventario = ordenarPorMenorCarga(disponibles, historialInventario, fecha);
    if (!elegiblesInventario.length) {
      avisos.push("Hay productos SICAR que necesitan conteo, pero no hay personal programado con perfil completo.");
    } else {
      const limitePorPersona = 30;
      const productosAsignados = Math.min(inventarioCritico.length, elegiblesInventario.length * limitePorPersona);
      const personasConLote = Math.ceil(productosAsignados / limitePorPersona);
      for (let indice = 0; indice < personasConLote; indice += 1) {
        const empleado = elegiblesInventario[indice];
        const lote = inventarioCritico.slice(indice * limitePorPersona, (indice + 1) * limitePorPersona);
        const listaProductos = lote.map((producto) => {
          const motivo = producto.motivoRevision || producto.nivelInventario || "REVISAR";
          const cobertura = Number.isFinite(Number(producto.diasCobertura)) ? ` · cobertura ${Math.round(Number(producto.diasCobertura))} días` : "";
          return `• ${producto.codigo || "Sin código"} · ${producto.descripcion || "Producto"} · SICAR: ${producto.existencia} · ${motivo}${cobertura}`;
        });
        tareas.push(crearTarea({
          fecha,
          empleado,
          area: "inventario",
          titulo: `Contar productos críticos de bodega · lote ${indice + 1} de ${personasConLote}`,
          descripcion: `Contar físicamente ${lote.length} ${lote.length === 1 ? "producto urgente" : "productos urgentes"} de esta sucursal, seleccionados del último reporte SICAR.`,
          instrucciones: [
            `Fuente SICAR de esta sucursal: ${fuenteInventario.fecha}${fuenteInventario.nombre ? ` · ${fuenteInventario.nombre}` : ""}.`,
            "Cuenta cada producto y registra la existencia física en el campo de resultado de esta tarea. Verifica código y descripción. No cambies SICAR ni hagas compras; reporta diferencias a Dirección.",
            ...listaProductos,
          ].join("\n"),
          criterioExito: `Existencia física registrada para los ${lote.length} ${lote.length === 1 ? "producto" : "productos"} del lote; diferencias reportadas a Dirección.`,
          prioridad: "alta",
        }));
      }
      if (inventarioCritico.length > productosAsignados) {
        avisos.push(`Se asignaron ${productosAsignados} de ${inventarioCritico.length} productos urgentes: el equipo disponible puede contar hasta ${limitePorPersona} cada persona. Los restantes quedan para la siguiente ronda.`);
      }
    }
  }

  return {
    tareas,
    avisos,
    empleadosDisponibles: disponibles.length,
    personasProgramadas: disponibles.map((empleado) => empleado.nombre),
    asistencias: idsPresentes === null ? [] : disponibles.map((empleado) => {
      const registro = (asistenciaRegistrada || []).find((item) => String(item?.empleado_id) === String(empleado.id));
      return { nombre: empleado.nombre, entrada_at: registro?.entrada_at || null };
    }),
    personasPresentes: idsPresentes ? disponibles.length : null,
    productosUrgentes: inventarioCritico.length,
    productosAsignados: Math.min(inventarioCritico.length, disponibles.length * 30),
  };
}

export function tareasPendientesDeRutina(tareas, existentes = []) {
  const listaExistente = Array.isArray(existentes) ? existentes : [];
  return (Array.isArray(tareas) ? tareas : []).filter((tarea) => !listaExistente.some((actual) =>
    llaveTarea(actual.titulo) === llaveTarea(tarea.titulo) &&
    llaveTarea(actual.area) === llaveTarea(tarea.area) &&
    llaveTarea(actual.responsable) === llaveTarea(tarea.responsable),
  ));
}

export function priorizarProductosParaConteo(productos = []) {
  const nivelPrioridad = { NEGATIVO: 0, AGOTADO: 1, CRITICO: 2, BAJO: 3 };
  return (Array.isArray(productos) ? [...productos] : []).sort((a, b) => {
    const nivelA = String(a?.nivelInventario || "").toUpperCase();
    const nivelB = String(b?.nivelInventario || "").toUpperCase();
    const prioridadA = Number(a?.existencia) < 0 ? 0 : (nivelPrioridad[nivelA] ?? 9);
    const prioridadB = Number(b?.existencia) < 0 ? 0 : (nivelPrioridad[nivelB] ?? 9);
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;
    const ventasA = Number(a?.ventaDiaria || a?.piezasVendidas || 0);
    const ventasB = Number(b?.ventaDiaria || b?.piezasVendidas || 0);
    if (ventasA !== ventasB) return ventasB - ventasA;
    const coberturaA = Number.isFinite(Number(a?.diasCobertura)) ? Number(a.diasCobertura) : Infinity;
    const coberturaB = Number.isFinite(Number(b?.diasCobertura)) ? Number(b.diasCobertura) : Infinity;
    return coberturaA - coberturaB;
  }).map((producto) => ({
    ...producto,
    motivoRevision: Number(producto?.existencia) < 0
      ? "NEGATIVO · validar ajuste o captura en SICAR"
      : String(producto?.nivelInventario || "").toUpperCase() === "AGOTADO"
        ? "AGOTADO · tiene ventas y SICAR marca cero"
        : String(producto?.nivelInventario || "").toUpperCase() === "CRITICO"
          ? "CRÍTICO · cobertura de hasta 7 días"
          : "BAJO · cobertura reducida",
  }));
}
