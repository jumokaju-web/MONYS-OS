function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function fechaTexto(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  return valor;
}

export function resumirImportacionUtilidad({ importacion, detalles = [], sucursal = null }) {
  let ventas = 0;
  let costo = 0;
  let utilidadBruta = 0;
  let periodoInicio = null;
  let periodoFin = null;
  let filasValidas = 0;

  for (const detalle of detalles) {
    const datos = detalle?.datos_originales || {};
    const venta = numero(datos.ventaTotal ?? datos.importe);
    const costoFila = numero(datos.costoTotal ?? datos.costo);
    const utilidad = numero(datos.utilidad);

    if (venta === null && costoFila === null && utilidad === null) continue;
    ventas += venta || 0;
    costo += costoFila || 0;
    utilidadBruta += utilidad || 0;
    filasValidas += 1;

    periodoInicio ||= fechaTexto(datos.periodoInicio);
    periodoFin ||= fechaTexto(datos.periodoFin);
  }

  if (!importacion?.id || !sucursal?.id || !periodoInicio || !periodoFin || filasValidas === 0) {
    return null;
  }

  return {
    id: importacion.id,
    branchId: sucursal.id,
    sucursal: sucursal.nombre || sucursal.name || "Sucursal",
    periodoInicio,
    periodoFin,
    ventas,
    costo,
    utilidadBruta,
    margen: ventas > 0 ? (utilidadBruta / ventas) * 100 : null,
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
    const variacionVentas = anterior?.ventas > 0
      ? ((semana.ventas - anterior.ventas) / anterior.ventas) * 100
      : null;
    anteriorPorSucursal.set(semana.branchId, semana);
    return { ...semana, variacionVentas };
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
