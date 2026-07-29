function convertirNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function generarResumenReporte(datos) {
  if (!Array.isArray(datos) || datos.length === 0) {
    return {
      totalRegistros: 0,
      cantidadTotal: 0,
      ventaTotal: 0,
      utilidadTotal: 0,
      articulosDiferentes: 0,
      productoMasVendido: "Sin información",
      cantidadProductoMasVendido: 0,
    };
  }

  let cantidadTotal = 0;
  let ventaTotal = 0;
  let utilidadTotal = 0;

  const productos = new Map();

  datos.forEach((fila) => {
    const cantidad = convertirNumero(fila.cantidad);
    const importe = convertirNumero(fila.importe);
    const utilidad = convertirNumero(fila.utilidad);

    cantidadTotal += cantidad;
    ventaTotal += importe;
    utilidadTotal += utilidad;

    const codigo = String(fila.codigo ?? "").trim();
    const descripcion =
      String(fila.descripcion ?? "").trim() ||
      "Producto sin descripción";

    const claveProducto =
      codigo !== ""
        ? codigo
        : descripcion.toLowerCase();

    const productoActual = productos.get(claveProducto) || {
      codigo,
      descripcion,
      cantidad: 0,
      importe: 0,
      utilidad: 0,
    };

    productoActual.cantidad += cantidad;
    productoActual.importe += importe;
    productoActual.utilidad += utilidad;

    productos.set(claveProducto, productoActual);
  });

  const listaProductos = Array.from(productos.values());

  const productoMasVendido = listaProductos.reduce(
    (mayor, producto) =>
      producto.cantidad > mayor.cantidad
        ? producto
        : mayor,
    {
      codigo: "",
      descripcion: "Sin información",
      cantidad: 0,
      importe: 0,
      utilidad: 0,
    }
  );

  return {
    totalRegistros: datos.length,
    cantidadTotal,
    ventaTotal,
    utilidadTotal,
    articulosDiferentes: productos.size,
    productoMasVendido: productoMasVendido.descripcion,
    codigoProductoMasVendido: productoMasVendido.codigo,
    cantidadProductoMasVendido:
      productoMasVendido.cantidad,
  };
}

export function generarResumenInventario(datos) {
  if (!Array.isArray(datos) || datos.length === 0) {
    return {
      totalRegistros: 0,
      articulosDiferentes: 0,
      existenciaTotal: 0,
      valorInventario: 0,
      productosConExistencia: 0,
      productosAgotados: 0,
      productosNegativos: 0,
      productoMayorExistencia: "Sin información",
      cantidadMayorExistencia: 0,
    };
  }

  let existenciaTotal = 0;
  let valorInventario = 0;
  let productosConExistencia = 0;
  let productosAgotados = 0;
  let productosNegativos = 0;

  const productos = new Map();

  datos.forEach((fila) => {
    const existencia = convertirNumero(
      fila.existencia ?? fila.cantidad
    );

   const precioUnitario = convertirNumero(
  fila.precioUnitario ?? fila.precioCompra
);

const total = convertirNumero(
  fila.total ?? fila.valorInventario
);

const valorProducto =
  total !== 0
    ? total
    : existencia * precioUnitario;
    
    existenciaTotal += existencia;
    valorInventario += valorProducto;

    if (existencia > 0) {
      productosConExistencia += 1;
    }

    if (existencia === 0) {
      productosAgotados += 1;
    }

    if (existencia < 0) {
      productosNegativos += 1;
    }

    const codigo = String(fila.codigo ?? "").trim();

    const descripcion =
      String(fila.descripcion ?? "").trim() ||
      "Producto sin descripción";

    const claveProducto =
      codigo !== ""
        ? codigo
        : descripcion.toLowerCase();

    const productoActual = productos.get(claveProducto) || {
      codigo,
      descripcion,
      existencia: 0,
      valorInventario: 0,
    };

    productoActual.existencia += existencia;
    productoActual.valorInventario += valorProducto;

    productos.set(claveProducto, productoActual);
  });

  const listaProductos = Array.from(productos.values());

  const productoMayorExistencia = listaProductos.reduce(
    (mayor, producto) =>
      producto.existencia > mayor.existencia
        ? producto
        : mayor,
    {
      codigo: "",
      descripcion: "Sin información",
      existencia: 0,
      valorInventario: 0,
    }
  );

  return {
    totalRegistros: datos.length,
    articulosDiferentes: productos.size,
    existenciaTotal,
    valorInventario,
    productosConExistencia,
    productosAgotados,
    productosNegativos,
    productoMayorExistencia:
      productoMayorExistencia.descripcion,
    codigoProductoMayorExistencia:
      productoMayorExistencia.codigo,
    cantidadMayorExistencia:
      productoMayorExistencia.existencia,
  };
}