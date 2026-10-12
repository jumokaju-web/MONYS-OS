function texto(valor) {
  return String(valor ?? "").trim();
}

function numero(valor) {
  if (valor === null || valor === undefined || texto(valor) === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const convertido = Number(texto(valor).replace(/[$,\s]/g, ""));
  return Number.isFinite(convertido) ? convertido : null;
}

export function normalizarProducto(valor) {
  return texto(valor)
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function recomendarProductoVendedora(datosDashboard) {
  const producto = datosDashboard?.metricas?.productoMasVendido || null;
  if (!producto?.descripcion) return null;

  const codigo = normalizarProducto(producto.codigo);
  const nombre = normalizarProducto(producto.descripcion);
  const inventario = Array.isArray(datosDashboard?.inventario?.detalles)
    ? datosDashboard.inventario.detalles
    : [];
  const coincidencia = inventario.find((fila) => {
    const raw = fila?.datos_originales || fila || {};
    const codigoInventario = normalizarProducto(
      fila?.codigo ?? raw.codigo ?? raw.clave ?? raw.sku,
    );
    const nombreInventario = normalizarProducto(
      fila?.descripcion ?? raw.descripcion ?? raw.producto ?? raw.articulo,
    );
    return (codigo && codigoInventario === codigo) || (nombre && nombreInventario === nombre);
  });
  const raw = coincidencia?.datos_originales || coincidencia || {};
  const existencia = numero(
    coincidencia?.existencia ?? raw.existencia ?? raw.existencias ?? raw.stock ?? raw.cantidad,
  );

  return {
    codigo: producto.codigo || "",
    nombre: producto.descripcion,
    piezasVendidas: Number(producto.cantidad) || 0,
    existencia,
    inventarioVerificado: existencia !== null,
  };
}

export function construirGuiaVenta({ producto, tareaPrioritaria } = {}) {
  if (tareaPrioritaria) {
    return {
      titulo: tareaPrioritaria.titulo,
      detalle:
        String(tareaPrioritaria.estado || "").toLowerCase() === "en_proceso"
          ? "Termina esta acción antes de abrir otra."
          : "Empieza con la tarea asignada de mayor prioridad.",
      origen: "TAREA ASIGNADA",
    };
  }
  if (producto?.inventarioVerificado && producto.existencia > 0) {
    return {
      titulo: `Ofrece ${producto.nombre}`,
      detalle: `Fue el producto con más piezas del último corte y aparecen ${producto.existencia} disponibles. Confirma la existencia física antes de prometerlo.`,
      origen: "VENTAS + INVENTARIO SICAR",
    };
  }
  if (producto) {
    return {
      titulo: `Revisa ${producto.nombre}`,
      detalle: "Fue el producto con más piezas del último corte, pero MONYS no pudo confirmar existencia disponible. Verifica físicamente antes de ofrecerlo.",
      origen: "VENTAS SICAR · EXISTENCIA PENDIENTE",
    };
  }
  return {
    titulo: "Atiende, detecta y registra",
    detalle: "Pregunta qué busca la clienta. Si no lo tenemos, registra el producto para que Dirección pueda decidir traslado o compra.",
    origen: "PROTOCOLO DE TIENDA",
  };
}
