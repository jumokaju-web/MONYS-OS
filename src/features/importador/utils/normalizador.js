import { saldoProveedor, fechaProveedor } from './datosProveedor.js';
import { normalizarFechaSicar } from './periodoSicar.js';
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

function convertirNumeroOpcional(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const texto = String(valor ?? "").replace(/[$,\s]/g, "").trim();
  if (!texto) return null;

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
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

  console.log(
  "ENCABEZADOS VENTAS:",
  encabezadosOriginales
);

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

        importeDisponible: columnas.importe >= 0,
        utilidadDisponible: columnas.utilidad >= 0,
        cantidadDisponible: columnas.cantidad >= 0,
        costoDisponible: columnas.costo >= 0,
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

  console.log("ENCABEZADOS VENTAS:", encabezadosOriginales);

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
  if (
    !Array.isArray(filas) ||
    filas.length < 2
  ) {
    return [];
  }

  const encabezadosOriginales =
    filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(
      limpiarEncabezado
    );

  const columnas = {
    documento:
      buscarColumna(
        encabezadosLimpios,
        [
          "documento",
        ]
      ),

    fecha:
      buscarColumna(
        encabezadosLimpios,
        [
          "fecha",
        ]
      ),

    folio:
      buscarColumna(
        encabezadosLimpios,
        [
          "folio",
        ]
      ),

    cliente:
      buscarColumna(
        encabezadosLimpios,
        [
          "cliente",
        ]
      ),

    caja:
      buscarColumna(
        encabezadosLimpios,
        [
          "caja",
        ]
      ),

    usuario:
      buscarColumna(
        encabezadosLimpios,
        [
          "usuario",
          "vendedor",
        ]
      ),

    totalVenta:
      buscarColumna(
        encabezadosLimpios,
        [
          "total ven",
          "total venta",
          "total ventas",
        ]
      ),

    totalCompra:
      buscarColumna(
        encabezadosLimpios,
        [
          "total com",
          "total compra",
          "total compras",
          "costo",
        ]
      ),

    utilidad:
      buscarColumna(
        encabezadosLimpios,
        [
          "utilidad",
        ]
      ),
  };

  const columnasObligatorias = [
    ["documento", "Documento"],
    ["folio", "Folio"],
    ["totalVenta", "Total de venta"],
    ["totalCompra", "Costo de venta"],
    ["utilidad", "Utilidad"],
  ];
  const faltantes = columnasObligatorias
    .filter(([clave]) => columnas[clave] < 0)
    .map(([, etiqueta]) => etiqueta);

  if (faltantes.length > 0) {
    throw new Error(
      `Al reporte SICAR de utilidad de ventas le faltan columnas financieras obligatorias: ${faltantes.join(", ")}. Vuelve a exportarlo con el detalle completo.`
    );
  }

  const datos =
    filas.slice(1);

  return datos
    .map((fila) => {
      const documento =
        String(
          obtenerValor(
            fila,
            columnas.documento
          )
        ).trim();

      const folio =
        String(
          obtenerValor(
            fila,
            columnas.folio
          )
        ).trim();

      const ventaTotal =
        convertirNumero(
          obtenerValor(
            fila,
            columnas.totalVenta
          )
        );

      const costoTotal =
        convertirNumero(
          obtenerValor(
            fila,
            columnas.totalCompra
          )
        );

      const utilidad =
        convertirNumero(
          obtenerValor(
            fila,
            columnas.utilidad
          )
        );

      return {
        documento,

        fecha:
          obtenerValor(
            fila,
            columnas.fecha
          ),

        folio,

        cliente:
          String(
            obtenerValor(
              fila,
              columnas.cliente
            )
          ).trim(),

        caja:
          String(
            obtenerValor(
              fila,
              columnas.caja
            )
          ).trim(),

        usuario:
          String(
            obtenerValor(
              fila,
              columnas.usuario
            )
          ).trim(),

        codigo:
          folio,

        descripcion:
          String(
            obtenerValor(
              fila,
              columnas.cliente
            )
          ).trim() ||
          "Venta sin cliente identificado",

        categoria:
          "Utilidad de ventas",

        cantidad:
          1,

        ventaTotal,
        costoTotal,
        utilidad,

        importe:
          ventaTotal,

        costo:
          costoTotal,

        tipoDato:
          "utilidad_ventas",
      };
    })
    .filter((fila) => {
      const tieneIdentidadVenta =
        fila.documento !== "" &&
        fila.folio !== "";

      const tieneMovimiento =
        fila.ventaTotal !== 0 ||
        fila.costoTotal !== 0 ||
        fila.utilidad !== 0;

      return (
        tieneIdentidadVenta &&
        tieneMovimiento
      );
    });
}

export function normalizarUtilidadArticulos(
  filas
) {
  if (
    !Array.isArray(filas) ||
    filas.length < 2
  ) {
    return [];
  }

  const encabezadosOriginales =
    filas[0];

  const encabezadosLimpios =
    encabezadosOriginales.map(
      limpiarEncabezado
    );

  const columnas = {
    codigo: buscarColumna(
      encabezadosLimpios,
      [
        "clave",
        "codigo",
        "codigo art",
        "codigo articulo",
        "sku",
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
        "unidades",
      ]
    ),

    totalCompra: buscarColumna(
      encabezadosLimpios,
      [
        "total com",
        "total compra",
        "total compras",
        "costo total",
        "costototal",
      ]
    ),

    totalVenta: buscarColumna(
      encabezadosLimpios,
      [
        "total ven",
        "total venta",
        "total ventas",
        "venta total",
        "ventatotal",
        "importe",
      ]
    ),

    utilidadPorcentaje:
      buscarColumna(
        encabezadosLimpios,
        [
          "util %",
          "utilidad %",
          "util porcentaje",
          "utilidad porcentaje",
        ]
      ),

    utilidad: buscarColumna(
      encabezadosLimpios,
      [
        "utilidad",
        "utilidad total",
        "utilidadtotal",
      ]
    ),
  };

  return filas
    .slice(1)
    .map((fila) => {
      const codigo = String(
        obtenerValor(
          fila,
          columnas.codigo
        )
      ).trim();

      const descripcion = String(
        obtenerValor(
          fila,
          columnas.descripcion
        )
      ).trim();

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

      const cantidad = convertirNumeroOpcional(
        obtenerValor(fila, columnas.cantidad)
      );

      const costoTotal = convertirNumeroOpcional(
        obtenerValor(fila, columnas.totalCompra)
      );

      const ventaTotal = convertirNumeroOpcional(
        obtenerValor(fila, columnas.totalVenta)
      );

      const utilidad = convertirNumeroOpcional(
        obtenerValor(fila, columnas.utilidad)
      );

      const utilidadPorcentaje = convertirNumeroOpcional(
        obtenerValor(fila, columnas.utilidadPorcentaje)
      );

      const margenSobreVenta =
        ventaTotal > 0 && utilidad !== null
          ? (
              utilidad /
              ventaTotal
            ) * 100
          : null;

      return {
        codigo,
        descripcion,

        departamento,

        categoria:
          categoria ||
          departamento ||
          "Sin categoría",

        cantidad,

        ventaTotal,
        costoTotal,
        utilidad,

        importe:
          ventaTotal,

        costo:
          costoTotal,

        utilidadPorcentaje,

        cantidadDisponible: cantidad !== null,
        costoDisponible: costoTotal !== null,
        importeDisponible: ventaTotal !== null,
        utilidadDisponible: utilidad !== null,

        margenSobreVenta,

        tipoDato:
          "utilidad_articulos",
      };
    })
    .filter(
      (fila) =>
        (fila.codigo !== "" || fila.descripcion !== "") &&
        (fila.cantidadDisponible || fila.costoDisponible || fila.importeDisponible || fila.utilidadDisponible)
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

    fechaVencimiento: buscarColumna(encabezadosLimpios, ['fecha vencimiento','fecha de vencimiento','vencimiento']),
    diasCredito: buscarColumna(encabezadosLimpios, ['dias credito','dias de credito']),
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

      const saldo = saldoProveedor(
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
        fechaVencimiento: fechaProveedor(obtenerValor(fila, columnas.fechaVencimiento)),
        diasCredito: String(obtenerValor(fila, columnas.diasCredito)).trim() === '' ? null : saldoProveedor(obtenerValor(fila, columnas.diasCredito)),

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
        (fila.saldo !== null && fila.saldo !== 0)
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

export function normalizarAbonosProveedores(filas) {
  if (!Array.isArray(filas) || filas.length < 2 || !Array.isArray(filas[0])) return [];

  const encabezados = filas[0].map(limpiarEncabezado);
  const columnas = {
    fecha: buscarColumna(encabezados, ["fecha"]),
    caja: buscarColumna(encabezados, ["caja"]),
    usuario: buscarColumna(encabezados, ["usuario"]),
    folio: buscarColumna(encabezados, ["folio c", "folio cheque", "folio de cheque"]),
    metodo: buscarColumna(encabezados, ["fp", "forma de pago"]),
    multipago: buscarColumna(encabezados, ["multipago", "multi pago"]),
    referencia: buscarColumna(encabezados, ["referencia"]),
    total: buscarColumna(encabezados, ["total"]),
  };
  if (Object.values(columnas).some((indice) => indice < 0)) return [];

  const abonos = [];
  let abonoActual = null;
  for (let indice = 1; indice < filas.length; indice += 1) {
    const fila = filas[indice];
    if (!Array.isArray(fila)) continue;
    const etiqueta = limpiarEncabezado(fila[0]);

    if (etiqueta === "proveedor:") {
      if (abonoActual) {
        const nombre = String(obtenerValor(fila, columnas.caja)).trim();
        abonoActual.proveedorNombre = nombre;
        const indiceRepresentante = fila.findIndex((valor) => limpiarEncabezado(valor) === "representante:");
        abonoActual.representante = indiceRepresentante >= 0
          ? String(fila.slice(indiceRepresentante + 1).find((valor) => String(valor ?? "").trim()) || "").trim()
          : "";
      }
      continue;
    }

    const fechaOriginal = obtenerValor(fila, columnas.fecha);
    const fecha = normalizarFechaSicar(fechaOriginal);
    const monto = convertirNumero(obtenerValor(fila, columnas.total));
    if (!fecha || monto <= 0) continue;

    abonoActual = {
      codigo: `ABONO-${indice}`,
      fecha,
      hora: normalizarHoraSicar(fechaOriginal),
      caja: String(obtenerValor(fila, columnas.caja)).trim(),
      usuario: String(obtenerValor(fila, columnas.usuario)).trim(),
      folioCheque: String(obtenerValor(fila, columnas.folio)).trim(),
      metodoPago: String(obtenerValor(fila, columnas.metodo)).trim().toUpperCase(),
      multipago: String(obtenerValor(fila, columnas.multipago)).trim(),
      referencia: String(obtenerValor(fila, columnas.referencia)).trim(),
      monto,
      total: monto,
      proveedorNombre: "",
      representante: "",
      tipoDato: "abono_proveedor_sicar",
    };
    abonos.push(abonoActual);
  }

  return abonos.filter((abono) => abono.proveedorNombre.length >= 2 && ["CH", "EF"].includes(abono.metodoPago));
}

export function normalizarHoraSicar(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(11, 19);
  }

  const numero = typeof valor === "number" ? valor : Number(valor);
  if (Number.isFinite(numero) && numero > 0) {
    const fraccion = ((numero % 1) + 1) % 1;
    const segundos = Math.round(fraccion * 86400) % 86400;
    const hora = Math.floor(segundos / 3600);
    const minuto = Math.floor((segundos % 3600) / 60);
    const segundo = segundos % 60;
    return [hora, minuto, segundo].map((parte) => String(parte).padStart(2, "0")).join(":");
  }

  const texto = String(valor ?? "").trim();
  const coincidencia = texto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!coincidencia) return null;
  return [coincidencia[1], coincidencia[2], coincidencia[3] || "00"]
    .map((parte) => String(parte).padStart(2, "0"))
    .join(":");
}

function claveMetodoCorte(nombre) {
  return limpiarEncabezado(nombre).replace(/\s+/g, "_") || "otro";
}

export function normalizarCortesCaja(filas, periodo = {}) {
  if (!Array.isArray(filas) || filas.length < 2) return [];

  const encabezados = filas[0].map(limpiarEncabezado);
  const columnas = {
    fecha: buscarColumna(encabezados, ["fecha"]),
    hora: buscarColumna(encabezados, ["hora"]),
    caja: buscarColumna(encabezados, ["caja"]),
    usuario: buscarColumna(encabezados, ["usuario"]),
    calculado: buscarColumna(encabezados, ["calculado"]),
    contado: buscarColumna(encabezados, ["contado"]),
    diferencia: buscarColumna(encabezados, ["diferencia"]),
    retirado: buscarColumna(encabezados, ["retirado"]),
  };
  const requeridas = Object.values(columnas);
  if (requeridas.some((indice) => indice < 0)) return [];

  const cortes = [];
  let corteActual = null;

  for (const fila of filas.slice(1)) {
    const fecha = normalizarFechaSicar(obtenerValor(fila, columnas.fecha));
    const caja = String(obtenerValor(fila, columnas.caja)).trim();

    if (fecha && caja) {
      corteActual = {
        codigo: `CORTE-${fecha}-${caja}-${normalizarHoraSicar(obtenerValor(fila, columnas.hora)) || "SIN-HORA"}`,
        descripcion: `Corte SICAR ${caja}`,
        categoria: "Cortes de caja",
        cantidad: 1,
        tipoDato: "corte_caja_sicar",
        fecha,
        hora: normalizarHoraSicar(obtenerValor(fila, columnas.hora)),
        caja,
        usuario: String(obtenerValor(fila, columnas.usuario)).trim() || null,
        calculado: convertirNumeroOpcional(obtenerValor(fila, columnas.calculado)),
        contado: convertirNumeroOpcional(obtenerValor(fila, columnas.contado)),
        diferenciaReportada: convertirNumeroOpcional(obtenerValor(fila, columnas.diferencia)),
        retirado: convertirNumeroOpcional(obtenerValor(fila, columnas.retirado)),
        periodoInicio: periodo?.periodoInicio ?? null,
        periodoFin: periodo?.periodoFin ?? null,
        metodos: [],
        alertas: [],
      };
      cortes.push(corteActual);
      continue;
    }

    if (!corteActual) continue;
    const nombreMetodo = String(obtenerValor(fila, columnas.caja + 1)).trim();
    if (!nombreMetodo) continue;

    const metodo = {
      clave: claveMetodoCorte(nombreMetodo),
      nombre: nombreMetodo,
      calculado: convertirNumeroOpcional(obtenerValor(fila, columnas.calculado + 1)),
      contado: convertirNumeroOpcional(obtenerValor(fila, columnas.contado + 1)),
      diferencia: convertirNumeroOpcional(obtenerValor(fila, columnas.diferencia + 1)),
      retirado: convertirNumeroOpcional(obtenerValor(fila, columnas.retirado + 1)),
    };
    metodo.esAnomaliaChequeNegativo = metodo.clave === "cheque"
      && metodo.calculado !== null
      && metodo.calculado < 0
      && (metodo.contado === null || metodo.contado === 0)
      && (metodo.retirado === null || metodo.retirado === 0);
    if (metodo.esAnomaliaChequeNegativo) {
      corteActual.alertas.push({
        tipo: "CHEQUE_NEGATIVO_SICAR",
        metodo: nombreMetodo,
        monto: metodo.calculado,
        mensaje: "SICAR reportó un cheque calculado negativo sin dinero contado ni retirado. Se conserva para auditoría y no se trata como faltante real.",
      });
    }
    corteActual.metodos.push(metodo);
  }

  return cortes.map((corte) => {
    const metodosOperativos = corte.metodos.filter((metodo) => !metodo.esAnomaliaChequeNegativo);
    const diferenciasDisponibles = metodosOperativos
      .map((metodo) => metodo.diferencia)
      .filter((valor) => valor !== null);
    const diferenciaOperativa = diferenciasDisponibles.length
      ? diferenciasDisponibles.reduce((total, valor) => total + valor, 0)
      : corte.diferenciaReportada;
    const metodosContadosDisponibles = corte.metodos
      .map((metodo) => metodo.contado)
      .filter((valor) => valor !== null);
    const sumaMetodosContados = metodosContadosDisponibles.reduce((total, valor) => total + valor, 0);
    const diferenciaDesglose = corte.contado === null || metodosContadosDisponibles.length === 0
      ? null
      : Math.round((corte.contado - sumaMetodosContados) * 100) / 100;

    return {
      ...corte,
      diferenciaOperativa: diferenciaOperativa === null ? null : Math.round(diferenciaOperativa * 100) / 100,
      desgloseContadoCoincide: diferenciaDesglose === null ? null : Math.abs(diferenciaDesglose) < 0.01,
      diferenciaDesglose,
    };
  });
}
