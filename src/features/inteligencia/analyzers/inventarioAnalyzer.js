// ======================================================
// MONYS OS
// Analizador Inteligente de Inventario 3.0
// Archivo: inventarioAnalyzer.js
// ======================================================

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function obtenerDatosOriginales(detalle) {
  return detalle?.datos_originales || {};
}

function obtenerCodigo(detalle) {
  const originales =
    obtenerDatosOriginales(detalle);

  return limpiarTexto(
    detalle?.codigo ??
      detalle?.clave ??
      detalle?.sku ??
      originales.codigo ??
      originales.clave ??
      originales.sku ??
      ""
  );
}

function obtenerDescripcion(detalle) {
  const originales =
    obtenerDatosOriginales(detalle);

  return limpiarTexto(
    detalle?.descripcion ??
      detalle?.nombre ??
      detalle?.producto ??
      originales.descripcion ??
      originales.nombre ??
      originales.producto ??
      "Producto sin descripción"
  );
}

function obtenerCategoria(detalle) {
  const originales =
    obtenerDatosOriginales(detalle);

  return limpiarTexto(
    detalle?.categoria ??
      originales.categoria ??
      originales.departamento ??
      "Sin categoría"
  );
}

function obtenerExistencia(detalle) {
  const originales =
    obtenerDatosOriginales(detalle);

  return convertirNumero(
    detalle?.existencia ??
      detalle?.exis ??
      detalle?.stock ??
      detalle?.cantidadExistencia ??
      originales.existencia ??
      originales.exis ??
      originales.stock ??
      originales.cantidadExistencia ??
      0
  );
}

function obtenerPrecioCompra(detalle) {
  const originales =
    obtenerDatosOriginales(detalle);

  return convertirNumero(
    detalle?.precioCompra ??
      detalle?.precio_compra ??
      detalle?.precioUnitario ??
      detalle?.precio_unitario ??
      detalle?.costo ??
      originales.precioCompra ??
      originales.precio_compra ??
      originales.precioUnitario ??
      originales.precio_unitario ??
      originales.costo ??
      0
  );
}

function obtenerCantidadVendida(detalle) {
  const originales =
    obtenerDatosOriginales(detalle);

  return convertirNumero(
    detalle?.cantidad ??
      detalle?.piezas ??
      detalle?.unidades ??
      originales.cantidad ??
      originales.cant ??
      originales.piezas ??
      originales.unidades ??
      0
  );
}

function crearLlaveProducto(detalle) {
  const codigo =
    obtenerCodigo(detalle);

  if (codigo) {
    return `codigo:${codigo.toLowerCase()}`;
  }

  const descripcion =
    obtenerDescripcion(detalle);

  return descripcion
    ? `descripcion:${descripcion.toLowerCase()}`
    : "";
}

function construirMapaVentas(ventas = []) {
  const mapa = new Map();

  if (!Array.isArray(ventas)) {
    return mapa;
  }

  for (const venta of ventas) {
    const llave =
      crearLlaveProducto(venta);

    if (!llave) {
      continue;
    }

    const cantidad =
      obtenerCantidadVendida(venta);

    const actual =
      mapa.get(llave) || {
        piezasVendidas: 0,
      };

    actual.piezasVendidas +=
      cantidad;

    mapa.set(llave, actual);
  }

  return mapa;
}

function calcularNivelInventario({
  existencia,
  ventaDiaria,
  diasCobertura,
}) {
  if (existencia < 0) {
    return "NEGATIVO";
  }

  /*
    AGOTADO REAL:
    existencia 0 + sí tuvo ventas.
  */
  if (
    existencia === 0 &&
    ventaDiaria > 0
  ) {
    return "AGOTADO";
  }

  /*
    Si no tiene ventas, no lo tratamos
    como producto urgente para resurtir.
  */
  if (ventaDiaria <= 0) {
    return "SIN_ROTACION";
  }

  if (diasCobertura <= 7) {
    return "CRITICO";
  }

  if (diasCobertura <= 15) {
    return "BAJO";
  }

  if (diasCobertura >= 90) {
    return "SOBREINVENTARIO";
  }

  return "SALUDABLE";
}

function calcularSugerenciaCompra({
  existencia,
  ventaDiaria,
  diasObjetivoInventario,
}) {
  /*
    Sin ventas registradas:
    no sugerimos compra.
  */
  if (ventaDiaria <= 0) {
    return 0;
  }

  const existenciaObjetivo =
    ventaDiaria *
    diasObjetivoInventario;

  return Math.max(
    0,
    Math.ceil(
      existenciaObjetivo -
        Math.max(0, existencia)
    )
  );
}

export function analizarInventario(
  detalles = [],
  opciones = {}
) {
  const inventario =
    Array.isArray(detalles)
      ? detalles
      : [];

  const ventas =
    Array.isArray(opciones?.ventas)
      ? opciones.ventas
      : [];

  const diasAnalizados =
    convertirNumero(
      opciones?.diasAnalizados
    );

  const diasObjetivoInventario =
    convertirNumero(
      opciones?.diasObjetivoInventario
    ) > 0
      ? convertirNumero(
          opciones.diasObjetivoInventario
        )
      : 30;

  if (inventario.length === 0) {
    return {
      resumen: {
        totalProductos: 0,
        productosConExistencia: 0,
        productosAgotados: 0,
        productosNegativos: 0,

        productosCriticos: 0,
        productosBajos: 0,
        productosSaludables: 0,
        productosSobreinventario: 0,
        productosSinRotacion: 0,

        existenciaTotal: 0,
        valorInventario: 0,

        inversionSugerida: 0,
        piezasSugeridasCompra: 0,
      },

      productos: [],
      alertas: [],
      sugerenciasCompra: [],
      sobreinventario: [],
      agotados: [],
    };
  }

  const mapaVentas =
    construirMapaVentas(ventas);

  let productosConExistencia = 0;
  let productosAgotados = 0;
  let productosNegativos = 0;

  let productosCriticos = 0;
  let productosBajos = 0;
  let productosSaludables = 0;
  let productosSobreinventario = 0;
  let productosSinRotacion = 0;

  let existenciaTotal = 0;
  let valorInventario = 0;

  let inversionSugerida = 0;
  let piezasSugeridasCompra = 0;

  const productos = [];
  const alertas = [];
  const sugerenciasCompra = [];
  const sobreinventario = [];
  const agotados = [];

  for (const detalle of inventario) {
    const codigo =
      obtenerCodigo(detalle);

    const descripcion =
      obtenerDescripcion(detalle);

    const categoria =
      obtenerCategoria(detalle);

    const existencia =
      obtenerExistencia(detalle);

    const precioCompra =
      obtenerPrecioCompra(detalle);

    const valorProducto =
      Math.max(0, existencia) *
      precioCompra;

    existenciaTotal +=
      existencia;

    valorInventario +=
      valorProducto;

    if (existencia > 0) {
      productosConExistencia += 1;
    }

    if (existencia < 0) {
      productosNegativos += 1;
    }

    const llave =
      crearLlaveProducto(detalle);

    const ventaProducto =
      mapaVentas.get(llave);

    const piezasVendidas =
      convertirNumero(
        ventaProducto?.piezasVendidas
      );

    /*
      Solo contamos como AGOTADO
      cuando está en cero Y sí tuvo demanda.
    */
    if (
      existencia === 0 &&
      piezasVendidas > 0
    ) {
      productosAgotados += 1;
    }

    const ventaDiaria =
      diasAnalizados > 0
        ? piezasVendidas /
          diasAnalizados
        : 0;

    const diasCobertura =
      ventaDiaria > 0 &&
      existencia > 0
        ? existencia /
          ventaDiaria
        : existencia === 0 &&
          ventaDiaria > 0
        ? 0
        : null;

    const nivelInventario =
      calcularNivelInventario({
        existencia,
        ventaDiaria,
        diasCobertura,
      });

    const sugerenciaCompra =
      calcularSugerenciaCompra({
        existencia,
        ventaDiaria,
        diasObjetivoInventario,
      });

    const inversionReposicion =
      sugerenciaCompra *
      precioCompra;

    if (
      nivelInventario ===
      "CRITICO"
    ) {
      productosCriticos += 1;
    }

    if (
      nivelInventario ===
      "BAJO"
    ) {
      productosBajos += 1;
    }

    if (
      nivelInventario ===
      "SALUDABLE"
    ) {
      productosSaludables += 1;
    }

    if (
      nivelInventario ===
      "SOBREINVENTARIO"
    ) {
      productosSobreinventario += 1;
    }

    if (
      nivelInventario ===
      "SIN_ROTACION"
    ) {
      productosSinRotacion += 1;
    }

    const productoAnalizado = {
      codigo,
      descripcion,
      categoria,

      existencia,
      precioCompra,

      valorInventario:
        valorProducto,

      piezasVendidas,

      ventaDiaria,

      diasCobertura,

      nivelInventario,

      sugerenciaCompra,

      inversionReposicion,
    };

    productos.push(
      productoAnalizado
    );

    /*
      EXISTENCIA NEGATIVA
    */
    if (existencia < 0) {
      alertas.push({
        tipo: "negativo",

        prioridad: "critica",

        descripcion,
        codigo,
        existencia,

        mensaje:
          "Producto con existencia negativa. Requiere revisión física y administrativa.",
      });

      continue;
    }

    /*
      AGOTADO REAL

      Solo entra aquí cuando:
      existencia = 0
      Y
      piezas vendidas > 0.
    */
    if (
      existencia === 0 &&
      piezasVendidas > 0
    ) {
      agotados.push(
        productoAnalizado
      );

      alertas.push({
        tipo: "agotado",

        prioridad: "critica",

        descripcion,
        codigo,
        existencia,

        piezasVendidas,

        mensaje:
          "Producto agotado con ventas registradas. Requiere revisión de reposición.",
      });
    }

    /*
      PRODUCTO EN CERO SIN VENTAS

      No genera alerta.
      No entra a agotados.
      No genera compra.
    */

    if (
      nivelInventario ===
      "CRITICO"
    ) {
      alertas.push({
        tipo:
          "cobertura_critica",

        prioridad:
          "critica",

        descripcion,
        codigo,

        existencia,

        diasCobertura,

        mensaje:
          `La existencia cubre aproximadamente ${diasCobertura.toFixed(
            1
          )} días de venta.`,
      });
    }

    if (
      nivelInventario ===
      "BAJO"
    ) {
      alertas.push({
        tipo:
          "inventario_bajo",

        prioridad:
          "alta",

        descripcion,
        codigo,

        existencia,

        diasCobertura,

        mensaje:
          `La existencia cubre aproximadamente ${diasCobertura.toFixed(
            1
          )} días.`,
      });
    }

    if (
      nivelInventario ===
      "SOBREINVENTARIO"
    ) {
      sobreinventario.push(
        productoAnalizado
      );
    }

    /*
      COMPRA

      Solo habrá sugerencia cuando
      realmente existe velocidad de venta.
    */
    if (
      sugerenciaCompra > 0
    ) {
      piezasSugeridasCompra +=
        sugerenciaCompra;

      inversionSugerida +=
        inversionReposicion;

      sugerenciasCompra.push({
        codigo,
        descripcion,
        categoria,

        existencia,

        piezasVendidas,

        ventaDiaria,

        diasCobertura,

        cantidadSugerida:
          sugerenciaCompra,

        precioCompra,

        inversionEstimada:
          inversionReposicion,

        prioridad:
          existencia <= 0
            ? "CRITICA"
            : diasCobertura !== null &&
              diasCobertura <= 7
            ? "ALTA"
            : "MEDIA",
      });
    }
  }

  sugerenciasCompra.sort(
    (a, b) => {
      const prioridad = {
        CRITICA: 1,
        ALTA: 2,
        MEDIA: 3,
      };

      const orden =
        prioridad[a.prioridad] -
        prioridad[b.prioridad];

      if (orden !== 0) {
        return orden;
      }

      return (
        b.piezasVendidas -
        a.piezasVendidas
      );
    }
  );

  sobreinventario.sort(
    (a, b) =>
      b.valorInventario -
      a.valorInventario
  );

  agotados.sort(
    (a, b) =>
      b.piezasVendidas -
      a.piezasVendidas
  );

  return {
    resumen: {
      totalProductos:
        inventario.length,

      productosConExistencia,

      productosAgotados,

      productosNegativos,

      productosCriticos,

      productosBajos,

      productosSaludables,

      productosSobreinventario,

      productosSinRotacion,

      existenciaTotal,

      valorInventario,

      inversionSugerida,

      piezasSugeridasCompra,
    },

    productos,

    alertas,

    sugerenciasCompra,

    sobreinventario,

    agotados,
  };
}