function limpiarEncabezado(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function convertirNumero(valor) {
  if (typeof valor === "number") {
    return valor;
  }

  const numero = Number(
    String(valor ?? "")
      .replace(/[$,\s]/g, "")
      .trim()
  );

  return Number.isFinite(numero) ? numero : 0;
}

function buscarColumna(encabezadosLimpios, opciones) {
  return encabezadosLimpios.findIndex((encabezado) =>
    opciones.some((opcion) => encabezado === opcion)
  );
}

function obtenerValor(fila, indice) {
  return indice >= 0 ? fila[indice] ?? "" : "";
}

export function normalizarVentasPorArticulo(filas) {
  if (!Array.isArray(filas) || filas.length < 2) {
    return [];
  }

  const encabezadosOriginales = filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(limpiarEncabezado);

  const columnas = {
    sucursal: buscarColumna(encabezadosLimpios, [
      "sucursal",
    ]),

    fecha: buscarColumna(encabezadosLimpios, [
      "fecha",
    ]),

    folioVenta: buscarColumna(encabezadosLimpios, [
      "folio venta",
      "folio",
    ]),

    codigo: buscarColumna(encabezadosLimpios, [
      "codigo art",
      "codigo articulo",
      "codigo",
      "clave",
    ]),

    descripcion: buscarColumna(encabezadosLimpios, [
      "descripcion",
      "producto",
      "articulo",
    ]),

    costo: buscarColumna(encabezadosLimpios, [
      "costo",
    ]),

    cantidad: buscarColumna(encabezadosLimpios, [
      "cantidad",
      "piezas",
    ]),

    importe: buscarColumna(encabezadosLimpios, [
      "importe",
      "total",
    ]),

    descuento: buscarColumna(encabezadosLimpios, [
      "descuento",
    ]),

    utilidad: buscarColumna(encabezadosLimpios, [
      "utilidad",
    ]),
  };

  const datos = filas.slice(1);

  return datos
    .map((fila) => ({
      sucursal: obtenerValor(
        fila,
        columnas.sucursal
      ),

      fecha: obtenerValor(
        fila,
        columnas.fecha
      ),

      folioVenta: obtenerValor(
        fila,
        columnas.folioVenta
      ),

      codigo: String(
        obtenerValor(fila, columnas.codigo)
      ).trim(),

      descripcion: String(
        obtenerValor(fila, columnas.descripcion)
      ).trim(),

      categoria: "",

      costo: convertirNumero(
        obtenerValor(fila, columnas.costo)
      ),

      cantidad: convertirNumero(
        obtenerValor(fila, columnas.cantidad)
      ),

      importe: convertirNumero(
        obtenerValor(fila, columnas.importe)
      ),

      descuento: convertirNumero(
        obtenerValor(fila, columnas.descuento)
      ),

      utilidad: convertirNumero(
        obtenerValor(fila, columnas.utilidad)
      ),
    }))
    .filter(
      (fila) =>
        fila.codigo !== "" ||
        fila.descripcion !== ""
    );
}

export function normalizarInventario(filas) {
  if (!Array.isArray(filas) || filas.length < 2) {
    return [];
  }

  const encabezadosOriginales = filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(limpiarEncabezado);

  const columnas = {
    codigo: buscarColumna(encabezadosLimpios, [
      "clave",
      "codigo",
      "codigo art",
      "codigo articulo",
      "sku",
    ]),

    descripcion: buscarColumna(encabezadosLimpios, [
      "descripcion",
      "producto",
      "articulo",
      "nombre",
    ]),

    precioUnitario: buscarColumna(
      encabezadosLimpios,
      [
        "precio u",
        "precio unitario",
        "precio",
      ]
    ),

    existencia: buscarColumna(encabezadosLimpios, [
      "exis",
      "existencia",
      "existencias",
    ]),

    total: buscarColumna(encabezadosLimpios, [
      "total",
      "valor total",
    ]),
  };

  const datos = filas.slice(1);

  return datos
    .map((fila) => {
      const existencia = convertirNumero(
        obtenerValor(fila, columnas.existencia)
      );

      const precioUnitario = convertirNumero(
        obtenerValor(
          fila,
          columnas.precioUnitario
        )
      );

      return {
        codigo: String(
          obtenerValor(fila, columnas.codigo)
        ).trim(),

        descripcion: String(
          obtenerValor(fila, columnas.descripcion)
        ).trim(),

        categoria: "",

        cantidad: existencia,
        existencia,
        precioUnitario,

        total: convertirNumero(
          obtenerValor(fila, columnas.total)
        ),

        tipoDato: "inventario",
      };
    })
    .filter(
      (fila) =>
        fila.codigo !== "" ||
        fila.descripcion !== ""
    );
}

export function normalizarInventarioUtilidad(filas) {
  if (!Array.isArray(filas) || filas.length < 2) {
    return [];
  }

  const encabezadosOriginales = filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(limpiarEncabezado);

  const columnas = {
    codigo: buscarColumna(encabezadosLimpios, [
      "clave",
      "codigo",
      "codigo art",
      "codigo articulo",
      "sku",
    ]),

    descripcion: buscarColumna(encabezadosLimpios, [
      "descripcion",
      "producto",
      "articulo",
      "nombre",
    ]),

    precioVenta: buscarColumna(encabezadosLimpios, [
      "precio venta",
      "precio de venta",
      "precio v",
    ]),

    precioCompra: buscarColumna(
      encabezadosLimpios,
      [
        "precio compra",
        "precio de compra",
        "precio c",
        "costo",
      ]
    ),

    margen: buscarColumna(encabezadosLimpios, [
      "margen",
      "margen porcentaje",
    ]),

    utilidadUnitaria: buscarColumna(
      encabezadosLimpios,
      [
        "utilidad unitaria",
        "utilidad uni",
      ]
    ),

    existencia: buscarColumna(encabezadosLimpios, [
      "existencia",
      "existencias",
      "exis",
    ]),

    utilidadTotal: buscarColumna(
      encabezadosLimpios,
      [
        "utilidad total",
      ]
    ),
  };

  const datos = filas.slice(1);

  return datos
    .map((fila) => {
      const existencia = convertirNumero(
        obtenerValor(fila, columnas.existencia)
      );

      const precioCompra = convertirNumero(
        obtenerValor(fila, columnas.precioCompra)
      );

      const precioVenta = convertirNumero(
        obtenerValor(fila, columnas.precioVenta)
      );

      return {
        codigo: String(
          obtenerValor(fila, columnas.codigo)
        ).trim(),

        descripcion: String(
          obtenerValor(fila, columnas.descripcion)
        ).trim(),

        categoria: "",

        cantidad: existencia,
        existencia,
        precioCompra,
        precioVenta,

        margen: convertirNumero(
          obtenerValor(fila, columnas.margen)
        ),

        utilidadUnitaria: convertirNumero(
          obtenerValor(
            fila,
            columnas.utilidadUnitaria
          )
        ),

        utilidadTotal: convertirNumero(
          obtenerValor(
            fila,
            columnas.utilidadTotal
          )
        ),

        valorInventario:
          existencia * precioCompra,

        tipoDato: "inventario_utilidad",
      };
    })
    .filter(
      (fila) =>
        fila.codigo !== "" ||
        fila.descripcion !== ""
    );
}