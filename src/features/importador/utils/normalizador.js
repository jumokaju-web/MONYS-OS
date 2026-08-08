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
    sucursal: buscarColumna(
      encabezadosLimpios,
      [
        "sucursal",
        "tienda",
      ]
    ),

    fecha: buscarColumna(
      encabezadosLimpios,
      [
        "fecha",
        "fecha venta",
      ]
    ),

    folioVenta: buscarColumna(
      encabezadosLimpios,
      [
        "folio venta",
        "folio",
        "no venta",
      ]
    ),

    codigo: buscarColumna(
      encabezadosLimpios,
      [
        "codigo art",
        "codigo articulo",
        "codigo",
        "clave",
      ]
    ),

    descripcion: buscarColumna(
      encabezadosLimpios,
      [
        "descripcion",
        "producto",
        "articulo",
        "nombre",
      ]
    ),

    departamento: buscarColumna(
      encabezadosLimpios,
      [
        "departamento",
        "depto",
      ]
    ),

    categoria: buscarColumna(
      encabezadosLimpios,
      [
        "categoria",
      ]
    ),

    cantidad: buscarColumna(
      encabezadosLimpios,
      [
        "cant",
        "cantidad",
        "piezas",
        "cantidad vendida",
        "unidades",
      ]
    ),

    costo: buscarColumna(
      encabezadosLimpios,
      [
        "costo",
        "costo unitario",
        "costo u",
      ]
    ),

    importe: buscarColumna(
      encabezadosLimpios,
      [
        "importe",
        "importe venta",
        "total",
        "venta total",
      ]
    ),

    descuento: buscarColumna(
      encabezadosLimpios,
      [
        "descuento",
        "desc",
      ]
    ),

    utilidad: buscarColumna(
      encabezadosLimpios,
      [
        "utilidad",
        "utilidad total",
      ]
    ),
  };

  return filas
    .slice(1)
    .map((fila) => {
      const departamento = String(
        obtenerValor(
          fila,
          columnas.departamento
        )
      ).trim();

      const categoria = String(
        obtenerValor(
          fila,
          columnas.categoria
        )
      ).trim();

      return {
        sucursal: String(
          obtenerValor(
            fila,
            columnas.sucursal
          )
        ).trim(),

        fecha: obtenerValor(
          fila,
          columnas.fecha
        ),

        folioVenta: String(
          obtenerValor(
            fila,
            columnas.folioVenta
          )
        ).trim(),

        codigo: String(
          obtenerValor(
            fila,
            columnas.codigo
          )
        ).trim(),

        descripcion: String(
          obtenerValor(
            fila,
            columnas.descripcion
          )
        ).trim(),

        departamento,

        categoria:
          categoria ||
          departamento ||
          "Sin categoría",

        cantidad: convertirNumero(
          obtenerValor(
            fila,
            columnas.cantidad
          )
        ),

        costo: convertirNumero(
          obtenerValor(
            fila,
            columnas.costo
          )
        ),

        importe: convertirNumero(
          obtenerValor(
            fila,
            columnas.importe
          )
        ),

        descuento: convertirNumero(
          obtenerValor(
            fila,
            columnas.descuento
          )
        ),

        utilidad: convertirNumero(
          obtenerValor(
            fila,
            columnas.utilidad
          )
        ),

        tipoDato: "ventas_articulo",
      };
    })
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

export function normalizarUtilidadVentas(filas) {
  if (!Array.isArray(filas) || filas.length < 2) {
    return [];
  }

  const encabezadosOriginales = filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(limpiarEncabezado);

  const columnas = {
    documento: buscarColumna(encabezadosLimpios, [
      "documento",
    ]),

    fecha: buscarColumna(encabezadosLimpios, [
      "fecha",
    ]),

    folio: buscarColumna(encabezadosLimpios, [
      "folio",
    ]),

    cliente: buscarColumna(encabezadosLimpios, [
      "cliente",
    ]),

    caja: buscarColumna(encabezadosLimpios, [
      "caja",
    ]),

    usuario: buscarColumna(encabezadosLimpios, [
      "usuario",
      "vendedor",
    ]),

    totalVenta: buscarColumna(encabezadosLimpios, [
      "total ven",
      "total venta",
      "total ventas",
    ]),

    totalCompra: buscarColumna(encabezadosLimpios, [
      "total com",
      "total compra",
      "total compras",
      "costo",
    ]),

    utilidad: buscarColumna(encabezadosLimpios, [
      "utilidad",
    ]),
  };

  const datos = filas.slice(1);

  return datos
    .map((fila) => {
      const ventaTotal = convertirNumero(
        obtenerValor(fila, columnas.totalVenta)
      );

      const costoTotal = convertirNumero(
        obtenerValor(fila, columnas.totalCompra)
      );

      const utilidad = convertirNumero(
        obtenerValor(fila, columnas.utilidad)
      );

      return {
        documento: String(
          obtenerValor(fila, columnas.documento)
        ).trim(),

        fecha: obtenerValor(
          fila,
          columnas.fecha
        ),

        folio: String(
          obtenerValor(fila, columnas.folio)
        ).trim(),

        cliente: String(
          obtenerValor(fila, columnas.cliente)
        ).trim(),

        caja: String(
          obtenerValor(fila, columnas.caja)
        ).trim(),

        usuario: String(
          obtenerValor(fila, columnas.usuario)
        ).trim(),

        codigo: String(
          obtenerValor(fila, columnas.folio)
        ).trim(),

        descripcion:
          String(
            obtenerValor(fila, columnas.cliente)
          ).trim() ||
          "Venta sin cliente identificado",

        categoria: "Utilidad de ventas",

        cantidad: 1,

        ventaTotal,
        costoTotal,
        utilidad,

        importe: ventaTotal,
        costo: costoTotal,

        tipoDato: "utilidad_ventas",
      };
    })
    .filter(
      (fila) =>
        fila.documento !== "" ||
        fila.folio !== "" ||
        fila.ventaTotal !== 0 ||
        fila.costoTotal !== 0 ||
        fila.utilidad !== 0
    );
}

export function normalizarExistencias(filas) {
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

    localizacion: buscarColumna(encabezadosLimpios, [
      "loc",
      "localizacion",
      "ubicacion",
    ]),

    minimo: buscarColumna(encabezadosLimpios, [
      "min i",
      "minimo",
      "existencia minima",
    ]),

    maximo: buscarColumna(encabezadosLimpios, [
      "max i",
      "maximo",
      "existencia maxima",
    ]),

    existencia: buscarColumna(encabezadosLimpios, [
      "exis",
      "existencia",
      "existencias",
    ]),
  };

  const datos = filas.slice(1);

  return datos
    .map((fila) => {
      const existencia = convertirNumero(
        obtenerValor(fila, columnas.existencia)
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

        localizacion: String(
          obtenerValor(fila, columnas.localizacion)
        ).trim(),

        minimo: convertirNumero(
          obtenerValor(fila, columnas.minimo)
        ),

        maximo: convertirNumero(
          obtenerValor(fila, columnas.maximo)
        ),

        tipoDato: "existencias",
      };
    })
    .filter(
      (fila) =>
        fila.codigo !== "" ||
        fila.descripcion !== ""
    );
}

export function normalizarCreditosProveedores(filas) {
  if (!Array.isArray(filas) || filas.length < 2) {
    return [];
  }

  const encabezadosOriginales = filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(limpiarEncabezado);

  const columnas = {
    numeroProveedor: buscarColumna(
      encabezadosLimpios,
      [
        "no prv",
        "numero proveedor",
        "numero de proveedor",
        "prv",
      ]
    ),

    nombre: buscarColumna(
      encabezadosLimpios,
      [
        "nombre",
        "proveedor",
      ]
    ),

    telefono: buscarColumna(
      encabezadosLimpios,
      [
        "telefono",
      ]
    ),

    celular: buscarColumna(
      encabezadosLimpios,
      [
        "celular",
      ]
    ),

    saldo: buscarColumna(
      encabezadosLimpios,
      [
        "saldo",
      ]
    ),
  };

  return filas
    .slice(1)
    .map((fila) => {
      const numeroProveedor = String(
        obtenerValor(
          fila,
          columnas.numeroProveedor
        )
      ).trim();

      const nombre = String(
        obtenerValor(fila, columnas.nombre)
      ).trim();

      const saldo = convertirNumero(
        obtenerValor(fila, columnas.saldo)
      );

      return {
        numeroProveedor,
        nombre,

        telefono: String(
          obtenerValor(fila, columnas.telefono)
        ).trim(),

        celular: String(
          obtenerValor(fila, columnas.celular)
        ).trim(),

        saldo,

        codigo: numeroProveedor,

        descripcion:
          nombre ||
          "Proveedor sin nombre identificado",

        categoria: "Créditos de proveedores",

        cantidad: 1,

        tipoDato: "creditos_proveedores",
      };
    })
    .filter(
      (fila) =>
        fila.numeroProveedor !== "" ||
        fila.nombre !== "" ||
        fila.saldo !== 0
    );
}

export function normalizarMovimientosCaja(filas) {
  if (!Array.isArray(filas) || filas.length < 2) {
    return [];
  }

  const encabezadosOriginales = filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(limpiarEncabezado);

  const columnas = {
    fecha: buscarColumna(encabezadosLimpios, [
      "fecha",
    ]),

    hora: buscarColumna(encabezadosLimpios, [
      "hora",
    ]),

    comentario: buscarColumna(
      encabezadosLimpios,
      [
        "comentario",
      ]
    ),

    corte: buscarColumna(encabezadosLimpios, [
      "corte",
    ]),

    pago: buscarColumna(encabezadosLimpios, [
      "pago",
    ]),

    entradaSalida: buscarColumna(
      encabezadosLimpios,
      [
        "e/s",
        "entrada salida",
        "entrada/salida",
      ]
    ),

    caja: buscarColumna(encabezadosLimpios, [
      "caja",
    ]),

    usuario: buscarColumna(encabezadosLimpios, [
      "usuario",
    ]),

    total: buscarColumna(encabezadosLimpios, [
      "total",
    ]),
  };

  return filas
    .slice(1)
    .map((fila, indice) => {
      const valorEntradaSalida = String(
        obtenerValor(
          fila,
          columnas.entradaSalida
        )
      )
        .trim()
        .toUpperCase();

      let tipoMovimiento = "";

      if (
        valorEntradaSalida === "E" ||
        valorEntradaSalida === "ENTRADA"
      ) {
        tipoMovimiento = "ENTRADA";
      }

      if (
        valorEntradaSalida === "S" ||
        valorEntradaSalida === "SALIDA"
      ) {
        tipoMovimiento = "SALIDA";
      }

      const total = convertirNumero(
        obtenerValor(fila, columnas.total)
      );

      const comentario = String(
        obtenerValor(fila, columnas.comentario)
      ).trim();

      const fecha = obtenerValor(
        fila,
        columnas.fecha
      );

      const hora = obtenerValor(
        fila,
        columnas.hora
      );

      return {
        codigo: `MOV-${indice + 1}`,

        descripcion:
          comentario ||
          "Movimiento de caja sin comentario",

        categoria: "Movimientos de caja",

        cantidad: 1,

        fecha,
        hora,
        comentario,

        corte: String(
          obtenerValor(fila, columnas.corte)
        ).trim(),

        metodoPago: String(
          obtenerValor(fila, columnas.pago)
        ).trim(),

        tipoMovimiento,

        tipo: tipoMovimiento,

        caja: String(
          obtenerValor(fila, columnas.caja)
        ).trim(),

        usuario: String(
          obtenerValor(fila, columnas.usuario)
        ).trim(),

        total,
        monto: total,

        estado: "Registrado",

        tipoDato: "movimientos_caja",
      };
    })
    .filter(
      (fila) =>
        fila.tipoMovimiento !== "" ||
        fila.total !== 0 ||
        fila.comentario !== ""
    );
}