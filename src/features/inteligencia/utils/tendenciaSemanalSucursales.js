function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function fechaTexto(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const fecha = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
    ? valor
    : null;
}

function diasPeriodo(inicio, fin) {
  if (!inicio || !fin) return null;
  const dias = Math.round(
    (new Date(`${fin}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86400000,
  ) + 1;
  return dias > 0 ? dias : null;
}

function variacionPorcentual(actual, anterior) {
  return numero(actual) !== null && numero(anterior) !== null && anterior > 0
    ? ((actual - anterior) / anterior) * 100
    : null;
}

export function resumirImportacionUtilidad({ importacion, detalles = [], sucursal = null }) {
  let ventas = 0;
  let costo = 0;
  let utilidadBruta = 0;
  let periodoInicio = null;
  let periodoFin = null;
  let filasValidas = 0;
  let filasVenta = 0;
  let filasCosto = 0;
  let filasUtilidad = 0;

  for (const detalle of detalles) {
    const datos = detalle?.datos_originales || {};
    const venta = numero(datos.ventaTotal ?? datos.importe);
    const costoFila = numero(datos.costoTotal ?? datos.costo);
    const utilidad = numero(datos.utilidad);

    if (venta === null && costoFila === null && utilidad === null) continue;
    if (venta !== null) {
      ventas += venta;
      filasVenta += 1;
    }
    if (costoFila !== null) {
      costo += costoFila;
      filasCosto += 1;
    }
    if (utilidad !== null) {
      utilidadBruta += utilidad;
      filasUtilidad += 1;
    }
    filasValidas += 1;

    periodoInicio ||= fechaTexto(datos.periodoInicio);
    periodoFin ||= fechaTexto(datos.periodoFin);
  }

  if (!importacion?.id || !sucursal?.id || !periodoInicio || !periodoFin || filasValidas === 0) {
    return null;
  }

  const ventasConfirmadas = filasVenta > 0 ? ventas : null;
  const costoConfirmado = filasCosto > 0 ? costo : null;
  const utilidadConfirmada = filasUtilidad > 0 ? utilidadBruta : null;

  return {
    id: importacion.id,
    branchId: sucursal.id,
    sucursal: sucursal.nombre || sucursal.name || "Sucursal",
    periodoInicio,
    periodoFin,
    ventas: ventasConfirmadas,
    costo: costoConfirmado,
    utilidadBruta: utilidadConfirmada,
    margen: ventasConfirmadas > 0 && utilidadConfirmada !== null
      ? (utilidadConfirmada / ventasConfirmadas) * 100
      : null,
    diasPeriodo: diasPeriodo(periodoInicio, periodoFin),
    filas: filasValidas,
    recibidoAt: importacion.created_at || null,
  };
}

export function construirTendenciaSemanal(semanas = []) {
  const unicas = new Map();

  [...semanas]
    .filter(Boolean)
    .sort((a, b) => String(b.recibidoAt || "").localeCompare(String(a.recibidoAt || "")))
    .forEach((semana) => {
      const clave = `${semana.branchId}:${semana.periodoInicio}:${semana.periodoFin}`;
      if (!unicas.has(clave)) unicas.set(clave, semana);
    });

  const ordenadas = [...unicas.values()].sort((a, b) => {
    const periodo = a.periodoInicio.localeCompare(b.periodoInicio);
    return periodo || a.sucursal.localeCompare(b.sucursal);
  });

  const anteriorPorSucursal = new Map();
  const conVariacion = ordenadas.map((semana) => {
    const anterior = anteriorPorSucursal.get(semana.branchId) || null;
    const comparable = Boolean(
      anterior &&
      semana.diasPeriodo &&
      anterior.diasPeriodo &&
      semana.diasPeriodo === anterior.diasPeriodo,
    );
    const variacionVentas = comparable ? variacionPorcentual(semana.ventas, anterior.ventas) : null;
    const variacionUtilidad = comparable
      ? variacionPorcentual(semana.utilidadBruta, anterior.utilidadBruta)
      : null;
    const variacionMargenPuntos = comparable && semana.margen !== null && anterior.margen !== null
      ? semana.margen - anterior.margen
      : null;
    anteriorPorSucursal.set(semana.branchId, semana);
    return {
      ...semana,
      variacionVentas,
      variacionUtilidad,
      variacionMargenPuntos,
      periodoAnteriorComparable: comparable,
    };
  });

  const periodos = [...new Set(conVariacion.map((semana) => `${semana.periodoInicio}:${semana.periodoFin}`))]
    .map((clave) => {
      const [periodoInicio, periodoFin] = clave.split(":");
      return {
        clave,
        periodoInicio,
        periodoFin,
        sucursales: conVariacion.filter(
          (semana) => semana.periodoInicio === periodoInicio && semana.periodoFin === periodoFin,
        ),
      };
    });

  return { semanas: conVariacion, periodos };
}

function lecturaSucursal(semana) {
  const ventas = semana?.variacionVentas;
  const utilidad = semana?.variacionUtilidad;
  const margen = semana?.variacionMargenPuntos;

  if (!semana?.periodoAnteriorComparable || ventas === null || utilidad === null) {
    return {
      estado: "sin-base",
      titulo: "Falta una semana comparable",
      accion: "Carga el siguiente corte con la misma duración para medir una tendencia real.",
    };
  }
  if (ventas < 0 && utilidad < 0) {
    return {
      estado: "riesgo",
      titulo: "Bajaron ventas y utilidad",
      accion: "Revisa productos agotados, atención y acciones comerciales antes de aumentar gasto.",
    };
  }
  if (ventas >= 0 && utilidad < 0) {
    return {
      estado: "margen",
      titulo: "Vende igual o más, pero gana menos",
      accion: "Revisa descuentos, mezcla de productos y costo antes de impulsar más volumen.",
    };
  }
  if (ventas < 0 && utilidad >= 0) {
    return {
      estado: "venta",
      titulo: "La venta bajó, pero la utilidad resistió",
      accion: "Protege el margen y recupera tráfico con una prueba pequeña y medible.",
    };
  }
  if (ventas > 0 && utilidad > 0 && (margen === null || margen >= -1)) {
    return {
      estado: "crece",
      titulo: "Crecimiento rentable",
      accion: "Identifica qué producto o acción explicó el avance antes de repetirla.",
    };
  }
  return {
    estado: "estable",
    titulo: "Movimiento sin deterioro crítico",
    accion: "Mantén la operación y confirma el siguiente corte antes de cambiar presupuesto.",
  };
}

export function construirLecturaEjecutiva(tendencia = {}) {
  const semanas = Array.isArray(tendencia?.semanas) ? tendencia.semanas : [];
  const ultimas = new Map();

  for (const semana of semanas) {
    const actual = ultimas.get(semana.branchId);
    if (!actual || semana.periodoFin > actual.periodoFin) ultimas.set(semana.branchId, semana);
  }

  const sucursales = [...ultimas.values()]
    .map((semana) => ({ ...semana, lectura: lecturaSucursal(semana) }))
    .sort((a, b) => a.sucursal.localeCompare(b.sucursal));
  const cortes = new Set(sucursales.map((semana) => `${semana.periodoInicio}:${semana.periodoFin}`));

  return {
    sucursales,
    comparacionMismoCorte: sucursales.length > 1 && cortes.size === 1,
    periodoInicio: cortes.size === 1 ? sucursales[0]?.periodoInicio || null : null,
    periodoFin: cortes.size === 1 ? sucursales[0]?.periodoFin || null : null,
  };
}

export function construirMetaRecuperacion(semanas = [], nombreSucursal = "General Anaya", crecimiento = 10) {
  const historial = semanas
    .filter((semana) => semana.sucursal.toLowerCase().includes(nombreSucursal.toLowerCase()))
    .sort((a, b) => b.periodoFin.localeCompare(a.periodoFin));
  const base = historial[0] || null;

  if (!base || base.ventas <= 0) return null;

  const objetivo = base.ventas * (1 + crecimiento / 100);
  const dias = Math.max(
    1,
    Math.round((new Date(`${base.periodoFin}T12:00:00Z`) - new Date(`${base.periodoInicio}T12:00:00Z`)) / 86400000) + 1,
  );

  return {
    base,
    crecimiento,
    objetivo,
    brecha: objetivo - base.ventas,
    incrementoDiario: (objetivo - base.ventas) / dias,
    dias,
  };
}

export function seleccionarCandidatosConDemanda(inventario = [], comparaciones = [], branchId, limite = 3) {
  const clave = (valor) => String(valor || "").trim().toLowerCase();
  const fin = (fila) => {
    const valor = fila?.periodoActual?.fin;
    return valor instanceof Date ? valor.toISOString().slice(0, 10) : fechaTexto(String(valor || "").slice(0, 10));
  };
  const filas = comparaciones.filter((fila) => fila.branchId === branchId && fin(fila));
  const ultimoFin = filas.map(fin).sort().at(-1);
  if (!ultimoFin) return [];
  const actuales = new Map(filas.filter((fila) => fin(fila) === ultimoFin && clave(fila.codigo)).map((fila) => [clave(fila.codigo), fila]));
  return seleccionarCandidatosCampana(inventario, Infinity)
    .flatMap((producto) => {
      const venta = actuales.get(clave(producto.codigo));
      if (!venta || venta.utilidadActualConfirmada !== true || !(venta.utilidadActual > 0) || !(venta.ventaActual > 0) || !(venta.unidadesActuales > 0)) return [];
      return [{ ...producto, unidadesVendidas: venta.unidadesActuales, ventaRegistrada: venta.ventaActual, utilidadRegistrada: venta.utilidadActual, periodoFin: ultimoFin }];
    })
    .sort((a, b) => b.utilidadRegistrada - a.utilidadRegistrada || b.unidadesVendidas - a.unidadesVendidas)
    .slice(0, limite);
}

export function seleccionarCandidatosCampana(inventario = [], limite = 3) {
  return inventario
    .map((detalle) => {
      const datos = detalle?.datos_originales || detalle || {};
      const existencia = numero(datos.existencia ?? datos.cantidad ?? detalle?.cantidad) || 0;
      const precioVenta = numero(datos.precioVenta) || 0;
      const precioCompra = numero(datos.precioCompra) || 0;
      const utilidadUnitaria = numero(datos.utilidadUnitaria) ?? (precioVenta - precioCompra);
      const descripcion = String(datos.descripcion || detalle?.descripcion || "").trim();
      const utilidadPotencial = existencia * Math.max(0, utilidadUnitaria);
      const margen = precioVenta > 0 ? (utilidadUnitaria / precioVenta) * 100 : null;
      return { codigo: datos.codigo || detalle?.codigo || "", descripcion, existencia, precioVenta, utilidadUnitaria, utilidadPotencial, margen };
    })
    .filter((producto) =>
      producto.descripcion &&
      producto.existencia >= 5 &&
      producto.existencia <= 500 &&
      producto.precioVenta >= 50 &&
      producto.precioVenta <= 600 &&
      producto.utilidadUnitaria > 0 &&
      producto.margen >= 25 &&
      producto.margen <= 70
    )
    .sort((a, b) => b.utilidadPotencial - a.utilidadPotencial || b.existencia - a.existencia)
    .slice(0, limite);
}
