// ======================================================
// MONYS OS
// Director Comercial IA
// ======================================================

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function limpiarTexto(valor) {
  return String(valor ?? "")
    .trim();
}

function obtenerNombreProducto(producto) {
  if (!producto) {
    return "";
  }

  if (typeof producto === "string") {
    return producto.trim();
  }

  return limpiarTexto(
    producto.descripcion ||
      producto.nombre ||
      producto.producto ||
      producto.articulo ||
      producto?.datos_originales?.descripcion ||
      producto?.datos_originales?.producto ||
      producto?.datos_originales?.articulo ||
      ""
  );
}

function obtenerCodigoProducto(producto) {
  return limpiarTexto(
    producto?.codigo ||
      producto?.clave ||
      producto?.sku ||
      producto?.datos_originales?.codigo ||
      producto?.datos_originales?.clave ||
      producto?.datos_originales?.sku ||
      ""
  );
}

function obtenerCategoriaProducto(producto) {
  return limpiarTexto(
    producto?.categoria ||
      producto?.datos_originales?.categoria ||
      producto?.datos_originales?.departamento ||
      "Sin categoría"
  );
}

function obtenerPiezasProducto(producto) {
  if (!producto || typeof producto === "string") {
    return 0;
  }

  return convertirNumero(
    producto.piezas ??
      producto.cantidad ??
      producto.totalPiezas ??
      producto.unidades ??
      producto?.datos_originales?.cantidad ??
      producto?.datos_originales?.cant ??
      0
  );
}

function obtenerImporteProducto(producto) {
  return convertirNumero(
    producto?.importe ??
      producto?.ventaTotal ??
      producto?.total ??
      producto?.datos_originales?.importe ??
      producto?.datos_originales?.ventaTotal ??
      producto?.datos_originales?.total ??
      0
  );
}

function obtenerCostoProducto(producto) {
  return convertirNumero(
    producto?.costo ??
      producto?.costoTotal ??
      producto?.datos_originales?.costo ??
      producto?.datos_originales?.costoTotal ??
      0
  );
}

function obtenerUtilidadProducto(producto) {
  return convertirNumero(
    producto?.utilidad ??
      producto?.utilidadTotal ??
      producto?.datos_originales?.utilidad ??
      producto?.datos_originales?.utilidadTotal ??
      0
  );
}

function obtenerFuenteComercial(
  datosDashboard = {}
) {
  const paquete =
    datosDashboard?.inteligencia?.comercial ||
    {};

  const ventas =
    Array.isArray(paquete.ventas)
      ? paquete.ventas
      : [];

  const ventasReales =
    Array.isArray(paquete.ventasReales)
      ? paquete.ventasReales
      : [];

  const ventasOriginales =
    Array.isArray(paquete.ventasOriginales)
      ? paquete.ventasOriginales
      : [];

  const utilidad =
    Array.isArray(paquete.utilidad)
      ? paquete.utilidad
      : [];

  const inventario =
    Array.isArray(paquete.inventario)
      ? paquete.inventario
      : [];

  return {
    ventas,
    ventasReales,
    ventasOriginales,
    utilidad,
    inventario,
  };
}

function agruparVentasPorProducto(
  ventas = []
) {
  const mapa = new Map();

  for (const fila of ventas) {
    const codigo =
      obtenerCodigoProducto(fila);

    const nombre =
      obtenerNombreProducto(fila);

    const llave =
      codigo ||
      nombre.toLowerCase();

    if (!llave) {
      continue;
    }

    if (!mapa.has(llave)) {
      mapa.set(llave, {
        codigo,
        nombre:
          nombre ||
          "Producto sin descripción",
        categoria:
          obtenerCategoriaProducto(fila),

        piezas: 0,
        importe: 0,
        costo: 0,
        utilidad: 0,
      });
    }

    const producto =
      mapa.get(llave);

    producto.piezas +=
      obtenerPiezasProducto(fila);

    producto.importe +=
      obtenerImporteProducto(fila);

    producto.costo +=
      obtenerCostoProducto(fila);

    producto.utilidad +=
      obtenerUtilidadProducto(fila);

    if (
      producto.categoria ===
        "Sin categoría" &&
      obtenerCategoriaProducto(fila) !==
        "Sin categoría"
    ) {
      producto.categoria =
        obtenerCategoriaProducto(fila);
    }
  }

  return Array.from(
    mapa.values()
  );
}

function construirTopProductos(
  productos = []
) {
  return [...productos]
    .sort(
      (a, b) =>
        b.piezas - a.piezas
    )
    .slice(0, 10)
    .map(
      (producto, indice) => ({
        posicion: indice + 1,
        ...producto,
      })
    );
}

function analizarCategorias(
  productos = []
) {
  const mapa = new Map();

  for (const producto of productos) {
    const categoria =
      producto.categoria ||
      "Sin categoría";

    if (!mapa.has(categoria)) {
      mapa.set(categoria, {
        categoria,
        piezas: 0,
        importe: 0,
        utilidad: 0,
        productos: 0,
      });
    }

    const item =
      mapa.get(categoria);

    item.piezas +=
      convertirNumero(
        producto.piezas
      );

    item.importe +=
      convertirNumero(
        producto.importe
      );

    item.utilidad +=
      convertirNumero(
        producto.utilidad
      );

    item.productos += 1;
  }

  return Array.from(
    mapa.values()
  ).sort(
    (a, b) =>
      b.piezas - a.piezas
  );
}

function calcularConcentracionVentas(
  productos = []
) {
  const totalPiezas =
    productos.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto.piezas
        ),
      0
    );

  if (totalPiezas <= 0) {
    return {
      totalPiezas: 0,
      top3Piezas: 0,
      porcentajeTop3: 0,
      nivel:
        "Sin datos suficientes",
    };
  }

  const top3 =
    [...productos]
      .sort(
        (a, b) =>
          b.piezas - a.piezas
      )
      .slice(0, 3);

  const top3Piezas =
    top3.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto.piezas
        ),
      0
    );

  const porcentajeTop3 =
    (
      top3Piezas /
      totalPiezas
    ) * 100;

  let nivel =
    "Concentración saludable";

  if (porcentajeTop3 >= 60) {
    nivel =
      "Alta dependencia de pocos productos";
  } else if (
    porcentajeTop3 >= 40
  ) {
    nivel =
      "Concentración moderada";
  }

  return {
    totalPiezas,
    top3Piezas,
    porcentajeTop3,
    nivel,
  };
}

function analizarVentas(
  datosDashboard = {}
) {
  const metricas =
    datosDashboard?.metricas ||
    {};

  const fuente =
    obtenerFuenteComercial(
      datosDashboard
    );

  const productos =
    agruparVentasPorProducto(
      fuente.ventas
    );

  const topProductos =
    construirTopProductos(
      productos
    );

  const categorias =
    analizarCategorias(
      productos
    );

  const concentracion =
    calcularConcentracionVentas(
      productos
    );

  const productoMasVendido =
    metricas.productoMasVendido ||
    topProductos[0] ||
    null;

  return {
    ventasTotales:
      convertirNumero(
        metricas.ventasTotales
      ),

    costoTotal:
      convertirNumero(
        metricas.costoTotal
      ),

    utilidadTotal:
      convertirNumero(
        metricas.utilidadTotal ??
          metricas.utilidad
      ),

    margenUtilidad:
      convertirNumero(
        metricas.margenUtilidad
      ),

    totalProductos:
      convertirNumero(
        metricas.totalProductos ??
          productos.length
      ),

    totalPiezas:
      convertirNumero(
        metricas.totalPiezas
      ),

    ticketPromedio:
      convertirNumero(
        metricas.ticketPromedio
      ),

    productoLider: {
      codigo:
        obtenerCodigoProducto(
          productoMasVendido
        ),

      nombre:
        obtenerNombreProducto(
          productoMasVendido
        ),

      piezas:
        obtenerPiezasProducto(
          productoMasVendido
        ),

      categoria:
        obtenerCategoriaProducto(
          productoMasVendido
        ),
    },

    topProductos,

    categorias,

    concentracion,

    productosAnalizados:
      productos.length,

    fuente,
  };
}

function obtenerNivelComercial(
  indicadores
) {
  if (
    indicadores.ventasTotales <= 0 &&
    indicadores.totalPiezas <= 0
  ) {
    return {
      nivel: "sin-datos",
      etiqueta:
        "Sin datos comerciales",
      prioridad: "MEDIA",
    };
  }

  if (
    indicadores.utilidadTotal < 0 ||
    (
      indicadores.margenUtilidad > 0 &&
      indicadores.margenUtilidad < 15
    )
  ) {
    return {
      nivel: "critico",
      etiqueta:
        "Rentabilidad comprometida",
      prioridad: "ALTA",
    };
  }

  if (
    indicadores.margenUtilidad > 0 &&
    indicadores.margenUtilidad < 25
  ) {
    return {
      nivel: "atencion",
      etiqueta:
        "Margen por mejorar",
      prioridad: "ALTA",
    };
  }

  if (
    indicadores.margenUtilidad > 0 &&
    indicadores.margenUtilidad < 35
  ) {
    return {
      nivel: "estable",
      etiqueta:
        "Desempeño comercial estable",
      prioridad: "MEDIA",
    };
  }

  return {
    nivel: "fuerte",
    etiqueta:
      "Desempeño comercial favorable",
    prioridad: "BAJA",
  };
}

function generarOportunidades(
  indicadores
) {
  const oportunidades = [];

  const top =
    indicadores.topProductos ||
    [];

  const categorias =
    indicadores.categorias ||
    [];

  if (top.length > 0) {
    const lider = top[0];

    oportunidades.push({
      tipo: "RESURTIDO",
      prioridad: "ALTA",
      titulo:
        "Proteger disponibilidad del producto líder",
      descripcion:
        `${lider.nombre} encabeza el periodo con ${lider.piezas.toLocaleString(
          "es-MX"
        )} piezas vendidas. Verifica existencia antes de una compra general.`,
      producto: lider.nombre,
    });
  }

  if (top.length >= 3) {
    const nombres =
      top
        .slice(0, 3)
        .map(
          (producto) =>
            producto.nombre
        )
        .join(", ");

    oportunidades.push({
      tipo: "FOCO_COMERCIAL",
      prioridad: "MEDIA",
      titulo:
        "Concentrar esfuerzo en los líderes",
      descripcion:
        `Los productos con mayor movimiento son ${nombres}. Úsalos para resurtido, exhibición y campañas.`,
    });
  }

  if (categorias.length > 0) {
    const lider =
      categorias[0];

    oportunidades.push({
      tipo: "CATEGORIA",
      prioridad: "MEDIA",
      titulo:
        "Impulsar la categoría con mayor movimiento",
      descripcion:
        `${lider.categoria} lidera con ${lider.piezas.toLocaleString(
          "es-MX"
        )} piezas vendidas en el periodo.`,
      categoria:
        lider.categoria,
    });
  }

  if (
    indicadores.concentracion
      .porcentajeTop3 >= 60
  ) {
    oportunidades.push({
      tipo: "RIESGO",
      prioridad: "ALTA",
      titulo:
        "Reducir dependencia de pocos productos",
      descripcion:
        `Los tres productos principales concentran ${indicadores.concentracion.porcentajeTop3.toFixed(
          2
        )}% de las piezas vendidas. Conviene desarrollar productos secundarios para reducir riesgo.`,
    });
  }

  return oportunidades;
}

function generarRecomendaciones(
  indicadores,
  nivelComercial
) {
  const recomendaciones = [];

  if (
    indicadores.ventasTotales <= 0 &&
    indicadores.totalPiezas <= 0
  ) {
    recomendaciones.push(
      "Importa un reporte de ventas de SICAR para iniciar el análisis comercial."
    );

    return recomendaciones;
  }

  if (
    indicadores.margenUtilidad > 0 &&
    indicadores.margenUtilidad < 25
  ) {
    recomendaciones.push(
      "Revisa precios de venta, descuentos y costos para recuperar margen."
    );
  }

  if (
    indicadores.productoLider.nombre
  ) {
    recomendaciones.push(
      `${indicadores.productoLider.nombre} es el producto líder con ${indicadores.productoLider.piezas.toLocaleString(
        "es-MX"
      )} piezas. Revisa existencias antes de autorizar compras generales.`
    );
  }

  if (
    indicadores.concentracion
      .porcentajeTop3 >= 60
  ) {
    recomendaciones.push(
      `Existe alta concentración: los tres productos principales representan ${indicadores.concentracion.porcentajeTop3.toFixed(
        2
      )}% del volumen. Protege su inventario, pero evita depender exclusivamente de ellos.`
    );
  }

  if (
    nivelComercial.nivel ===
    "fuerte"
  ) {
    recomendaciones.push(
      "El margen comercial es favorable. Prioriza productos de alta rotación sin comprometer la liquidez."
    );
  }

  if (
    indicadores.categorias.length >
    0
  ) {
    recomendaciones.push(
      `La categoría con mayor movimiento es ${indicadores.categorias[0].categoria}. Revisa si merece mayor exhibición o publicidad.`
    );
  }

  if (
    recomendaciones.length === 0
  ) {
    recomendaciones.push(
      "El desempeño comercial es estable. Mantén seguimiento de ventas, utilidad, categorías y rotación."
    );
  }

  return recomendaciones;
}

function generarPlanAccion(
  indicadores,
  nivelComercial
) {
  const planAccion = [];

  if (
    indicadores.ventasTotales <= 0 &&
    indicadores.totalPiezas <= 0
  ) {
    planAccion.push(
      "Importar el reporte de ventas más reciente."
    );

    return planAccion;
  }

  if (
    indicadores.productoLider.nombre
  ) {
    planAccion.push(
      `Verificar existencias de ${indicadores.productoLider.nombre}.`
    );
  }

  const top5 =
    indicadores.topProductos
      .slice(0, 5)
      .map(
        (producto) =>
          producto.nombre
      );

  if (top5.length > 0) {
    planAccion.push(
      `Revisar disponibilidad de los cinco productos con mayor movimiento: ${top5.join(
        ", "
      )}.`
    );
  }

  if (
    nivelComercial.nivel ===
      "critico" ||
    nivelComercial.nivel ===
      "atencion"
  ) {
    planAccion.push(
      "Revisar productos con margen bajo antes de autorizar nuevas promociones."
    );
  }

  if (
    indicadores.categorias.length >
    0
  ) {
    planAccion.push(
      `Analizar oportunidades de campaña para la categoría ${indicadores.categorias[0].categoria}.`
    );
  }

  planAccion.push(
    "Comparar este reporte con el siguiente periodo para detectar crecimiento o caída."
  );

  return planAccion;
}

function generarAccionesPrioritarias(
  indicadores
) {
  const acciones = [];

  const top =
    indicadores.topProductos ||
    [];

  if (top.length > 0) {
    acciones.push({
      prioridad: "ALTA",
      titulo:
        "Revisar inventario del producto líder",
      descripcion:
        `${top[0].nombre} vendió ${top[0].piezas.toLocaleString(
          "es-MX"
        )} piezas. Confirma existencia antes de que se agote.`,
      impacto: "ALTO",
      responsable:
        "Director Comercial",
    });
  }

  if (
    indicadores.concentracion
      .porcentajeTop3 >= 60
  ) {
    acciones.push({
      prioridad: "ALTA",
      titulo:
        "Reducir concentración comercial",
      descripcion:
        `Los tres productos principales concentran ${indicadores.concentracion.porcentajeTop3.toFixed(
          2
        )}% de las piezas vendidas.`,
      impacto: "ALTO",
      responsable:
        "Director Comercial",
    });
  }

  if (
    indicadores.categorias.length >
    0
  ) {
    acciones.push({
      prioridad: "MEDIA",
      titulo:
        "Impulsar categoría líder",
      descripcion:
        `${indicadores.categorias[0].categoria} es la categoría con mayor movimiento del periodo.`,
      impacto: "MEDIO",
      responsable:
        "Director Comercial",
    });
  }

  if (top.length >= 5) {
    acciones.push({
      prioridad: "MEDIA",
      titulo:
        "Priorizar los cinco productos más vendidos",
      descripcion:
        `Da seguimiento especial a ${top
          .slice(0, 5)
          .map(
            (producto) =>
              producto.nombre
          )
          .join(", ")}.`,
      impacto: "ALTO",
      responsable:
        "Director Comercial",
    });
  }

  return acciones.slice(0, 5);
}

export function directorComercialIA(
  datosDashboard = {}
) {
  const indicadores =
    analizarVentas(
      datosDashboard
    );

  const nivelComercial =
    obtenerNivelComercial(
      indicadores
    );

  const oportunidades =
    generarOportunidades(
      indicadores
    );

  const recomendaciones =
    generarRecomendaciones(
      indicadores,
      nivelComercial
    );

  const planAccion =
    generarPlanAccion(
      indicadores,
      nivelComercial
    );

  const accionesPrioritarias =
    generarAccionesPrioritarias(
      indicadores
    );

  return {
    nombre:
      "Director Comercial IA",

    version:
      "3.0.0",

    indicadores,

    nivelComercial,

    topProductos:
      indicadores.topProductos,

    categorias:
      indicadores.categorias,

    concentracion:
      indicadores.concentracion,

    oportunidades,

    recomendaciones,

    planAccion,

    accionesPrioritarias,

    generadoEn:
      new Date().toISOString(),
  };
}