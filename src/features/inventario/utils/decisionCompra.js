function numeroONulo(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function prioridadPorCobertura(cobertura) {
  if (cobertura === null) return "POR_REVISAR";
  if (cobertura <= 7) return "CRITICA";
  if (cobertura <= 15) return "ALTA";
  if (cobertura <= 30) return "MEDIA";
  return "BAJA";
}

const pesoPrioridad = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3, POR_REVISAR: 4 };

export function priorizarProductosCompra(productos = []) {
  return (Array.isArray(productos) ? productos : []).map((producto) => {
    const sucursales = (Array.isArray(producto?.sucursales) ? producto.sucursales : [])
      .filter((sucursal) => sucursal?.requiereRevisionInventario !== true);
    const coberturas = sucursales
      .map((sucursal) => numeroONulo(sucursal?.coberturaActual))
      .filter((valor) => valor !== null && valor >= 0);
    const coberturaMinima = coberturas.length ? Math.min(...coberturas) : null;
    const velocidadDiaria = sucursales.reduce(
      (total, sucursal) => total + Math.max(0, numeroONulo(sucursal?.ventaDiaria) || 0),
      0
    );
    const precioCompra = numeroONulo(producto?.precioCompra);
    const costoConocido = precioCompra !== null && precioCompra > 0;
    const margenPorcentaje = numeroONulo(producto?.margenPorcentaje);
    const margenConocido = margenPorcentaje !== null && margenPorcentaje > 0;
    const prioridad = prioridadPorCobertura(coberturaMinima);
    const sucursalesCriticas = sucursales.filter((sucursal) => {
      const cobertura = numeroONulo(sucursal?.coberturaActual);
      return cobertura !== null && cobertura <= 7;
    }).map((sucursal) => sucursal.sucursal || "Sucursal");

    return {
      ...producto,
      prioridadCompra: prioridad,
      coberturaMinima,
      velocidadDiaria,
      costoConocido,
      margenPorcentaje: margenConocido ? margenPorcentaje : null,
      margenConocido,
      sucursalesCriticas,
      motivoPrioridad: coberturaMinima === null
        ? "Cobertura pendiente de comprobar."
        : `${coberturaMinima.toFixed(1)} días de cobertura mínima; venta estimada ${velocidadDiaria.toFixed(1)} piezas por día.`,
    };
  }).sort((a, b) =>
    (pesoPrioridad[a.prioridadCompra] ?? 9) - (pesoPrioridad[b.prioridadCompra] ?? 9)
    || (a.coberturaMinima ?? Number.POSITIVE_INFINITY) - (b.coberturaMinima ?? Number.POSITIVE_INFINITY)
    || b.velocidadDiaria - a.velocidadDiaria
    || (b.margenPorcentaje ?? -1) - (a.margenPorcentaje ?? -1)
    || Number(b.inversionTotal || 0) - Number(a.inversionTotal || 0)
  );
}

export function construirDecisionCompra({
  compraMaestra = {},
  capacidadCompra = null,
  disponibilidadConfirmada = false,
} = {}) {
  const productosPriorizados = priorizarProductosCompra(compraMaestra?.productos);
  const inversionPropuesta = Math.max(0, numeroONulo(compraMaestra?.inversionTotal) || 0);
  const capacidad = numeroONulo(capacidadCompra);
  const presupuestoConfirmado = disponibilidadConfirmada === true && capacidad !== null && capacidad >= 0;
  const productosSinCosto = productosPriorizados.filter((producto) => !producto.costoConocido);
  const productosSinMargen = productosPriorizados.filter((producto) => !producto.margenConocido);
  const fuentes = Array.isArray(compraMaestra?.fuentes) ? compraMaestra.fuentes : [];
  const fuentesIncompletas = fuentes.filter((fuente) => !fuente.inventarioDisponible || !fuente.ventasDisponibles);
  const periodosAlineados = compraMaestra?.calidadDatos?.periodosVentasAlineados === true;
  const bloqueos = [];

  if (!presupuestoConfirmado) bloqueos.push("Confirmar dinero disponible y presupuesto de compra en Finanzas.");
  if (productosSinCosto.length) bloqueos.push(`Completar costo de ${productosSinCosto.length} producto${productosSinCosto.length === 1 ? "" : "s"}.`);
  if (!periodosAlineados) bloqueos.push("Alinear el periodo de ventas de todas las sucursales.");
  if (fuentesIncompletas.length) bloqueos.push(`Completar inventario y ventas de ${fuentesIncompletas.length} sucursal${fuentesIncompletas.length === 1 ? "" : "es"}.`);

  const superaPresupuesto = presupuestoConfirmado && inversionPropuesta > capacidad;
  if (superaPresupuesto) bloqueos.push(`La propuesta supera el presupuesto confirmado por ${(inversionPropuesta - capacidad).toFixed(2)} MXN.`);

  const listaCritica = productosPriorizados.filter((producto) => producto.prioridadCompra === "CRITICA");
  const inversionCritica = listaCritica.reduce((total, producto) => total + Math.max(0, Number(producto.inversionTotal) || 0), 0);
  const estado = bloqueos.length === 0
    ? "LISTA_PARA_AUTORIZACION"
    : superaPresupuesto ? "SUPERA_PRESUPUESTO" : "PENDIENTE_DATOS";

  const advertencias = [];
  if (productosSinMargen.length) {
    advertencias.push(`${productosSinMargen.length} producto${productosSinMargen.length === 1 ? "" : "s"} no tienen precio suficiente para calcular margen; se priorizan por cobertura y velocidad.`);
  }
  if (Number(compraMaestra?.totalProductosRevisionInventario) > 0) {
    advertencias.push(`${compraMaestra.totalProductosRevisionInventario} productos con existencia negativa permanecen fuera de la compra.`);
  }

  return {
    estado,
    listoParaAutorizar: estado === "LISTA_PARA_AUTORIZACION",
    presupuestoConfirmado,
    capacidadCompra: presupuestoConfirmado ? capacidad : null,
    inversionPropuesta,
    faltanteParaAutorizar: superaPresupuesto ? inversionPropuesta - capacidad : null,
    productosPriorizados,
    productosCriticos: listaCritica.length,
    inversionCritica,
    productosSinCosto: productosSinCosto.length,
    productosSinMargen: productosSinMargen.length,
    bloqueos,
    advertencias,
    fuentes,
  };
}
