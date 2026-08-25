// ======================================================
// MONYS OS
// Director Comercial IA
// ======================================================

import {
  analizarInventario,
} from "../analyzers/inventarioAnalyzer";

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
  indicadores,
  inventarioProductoLider = null
) {
  const oportunidades = [];

  const top =
    indicadores.topProductos || [];

  const categorias =
    indicadores.categorias || [];

  if (top.length > 0) {
    const lider = top[0];

    if (!inventarioProductoLider) {
      oportunidades.push({
        tipo: "VALIDACION",
        prioridad: "MEDIA",
        titulo:
          "Validar disponibilidad del producto líder",
        descripcion:
          `${lider.nombre} encabeza el periodo con ${lider.piezas.toLocaleString(
            "es-MX"
          )} piezas vendidas. Falta confirmar su inventario actual antes de tomar una decisión comercial.`,
        producto: lider.nombre,
      });
    } else {
      const nivel =
        inventarioProductoLider
          .nivelInventario;

      const existencia =
        inventarioProductoLider
          .existencia;

      const cobertura =
        Number(
          inventarioProductoLider
            .diasCobertura || 0
        );

      if (
        nivel === "AGOTADO" ||
        nivel === "CRITICO" ||
        nivel === "BAJO"
      ) {
        oportunidades.push({
          tipo: "RESURTIDO",
          prioridad:
            nivel === "AGOTADO"
              ? "CRITICA"
              : "ALTA",
          titulo:
            "Proteger ventas del producto líder",
          descripcion:
            `${lider.nombre} tiene ${existencia.toLocaleString(
              "es-MX"
            )} piezas y aproximadamente ${cobertura.toFixed(
              1
            )} días de cobertura. Conviene proteger su disponibilidad para evitar pérdida de ventas.`,
          producto: lider.nombre,
        });
      } else if (
        nivel === "SOBREINVENTARIO"
      ) {
        oportunidades.push({
          tipo: "ROTACION",
          prioridad: "MEDIA",
          titulo:
            "Aprovechar inventario disponible del producto líder",
          descripcion:
            `${lider.nombre} lidera las ventas y actualmente tiene ${existencia.toLocaleString(
              "es-MX"
            )} piezas, equivalentes a aproximadamente ${cobertura.toFixed(
              1
            )} días de cobertura. Existe oportunidad de impulsar su rotación sin realizar nuevas compras.`,
          producto: lider.nombre,
        });
      } else if (
        nivel === "SALUDABLE"
      ) {
        oportunidades.push({
          tipo: "VENTA",
          prioridad: "BAJA",
          titulo:
            "Mantener impulso del producto líder",
          descripcion:
            `${lider.nombre} tiene una cobertura saludable de aproximadamente ${cobertura.toFixed(
              1
            )} días. Puede mantenerse como producto estratégico sin aumentar innecesariamente el inventario.`,
          producto: lider.nombre,
        });
      }
    }
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
        `Los productos con mayor movimiento son ${nombres}. Úsalos para exhibición, seguimiento comercial y campañas, considerando siempre su cobertura de inventario.`,
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
  nivelComercial,
  inventarioProductoLider = null
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
    const nombre =
      indicadores.productoLider.nombre;

    const piezasVendidas =
      indicadores.productoLider.piezas;

    if (!inventarioProductoLider) {
      recomendaciones.push(
        `${nombre} es el producto líder con ${piezasVendidas.toLocaleString(
          "es-MX"
        )} piezas vendidas. Falta confirmar su inventario actual.`
      );
    } else {
      const nivel =
        inventarioProductoLider
          .nivelInventario;

      const existencia =
        inventarioProductoLider
          .existencia;

      const cobertura =
        Number(
          inventarioProductoLider
            .diasCobertura || 0
        );

      if (
        nivel === "SOBREINVENTARIO"
      ) {
        recomendaciones.push(
          `${nombre} es el producto líder y actualmente tiene ${existencia.toLocaleString(
            "es-MX"
          )} piezas, equivalentes a aproximadamente ${cobertura.toFixed(
            1
          )} días de cobertura. Impulsa su rotación antes de realizar nuevas compras.`
        );
      } else if (
        nivel === "AGOTADO"
      ) {
        recomendaciones.push(
          `${nombre} es el producto líder y actualmente está agotado. Protege sus ventas revisando reposición prioritaria.`
        );
      } else if (
        nivel === "CRITICO" ||
        nivel === "BAJO"
      ) {
        recomendaciones.push(
          `${nombre} tiene ${existencia.toLocaleString(
            "es-MX"
          )} piezas y aproximadamente ${cobertura.toFixed(
            1
          )} días de cobertura. Conviene preparar reposición sin exceder la capacidad financiera autorizada.`
        );
      } else if (
        nivel === "SALUDABLE"
      ) {
        recomendaciones.push(
          `${nombre} tiene inventario saludable con aproximadamente ${cobertura.toFixed(
            1
          )} días de cobertura. Mantén su disponibilidad sin sobrecomprar.`
        );
      } else {
        recomendaciones.push(
          `${nombre} continúa como producto líder. Mantén seguimiento de ventas e inventario antes de nuevas decisiones comerciales.`
        );
      }
    }
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
  nivelComercial,
  inventarioProductoLider = null
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
    const nombre =
      indicadores.productoLider.nombre;

    if (!inventarioProductoLider) {
      planAccion.push(
        `Confirmar inventario actual de ${nombre}.`
      );
    } else {
      const nivel =
        inventarioProductoLider
          .nivelInventario;

      const existencia =
        inventarioProductoLider
          .existencia;

      const cobertura =
        Number(
          inventarioProductoLider
            .diasCobertura || 0
        );

      if (
        nivel === "AGOTADO"
      ) {
        planAccion.push(
          `Atender reposición de ${nombre}: actualmente tiene existencia 0.`
        );
      } else if (
        nivel === "CRITICO" ||
        nivel === "BAJO"
      ) {
        planAccion.push(
          `Preparar reposición de ${nombre}: tiene ${existencia.toLocaleString(
            "es-MX"
          )} piezas y aproximadamente ${cobertura.toFixed(
            1
          )} días de cobertura.`
        );
      } else if (
        nivel === "SOBREINVENTARIO"
      ) {
        planAccion.push(
          `Impulsar rotación de ${nombre} antes de volver a comprar: tiene ${existencia.toLocaleString(
            "es-MX"
          )} piezas y aproximadamente ${cobertura.toFixed(
            1
          )} días de cobertura.`
        );
      } else if (
        nivel === "SALUDABLE"
      ) {
        planAccion.push(
          `Mantener disponibilidad de ${nombre} sin aumentar innecesariamente su inventario.`
        );
      } else {
        planAccion.push(
          `Dar seguimiento comercial e inventario a ${nombre}.`
        );
      }
    }
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
      `Dar seguimiento a los cinco productos con mayor movimiento: ${top5.join(
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

function obtenerInventarioProductoLider(
  datosDashboard,
  indicadores
) {
  const detallesInventario =
    datosDashboard?.inventario
      ?.detalles || [];

  const ventas =
    datosDashboard?.inteligencia
      ?.comercial?.ventas || [];

  const diasAnalizados =
    convertirNumero(
      datosDashboard?.metricas
        ?.diasAnalizados
    ) || 7;

  const analisisInventario =
    analizarInventario(
      detallesInventario,
      {
        ventas,
        diasAnalizados,
        diasObjetivoInventario: 30,
      }
    );

  const productos =
    Array.isArray(
      analisisInventario?.productos
    )
      ? analisisInventario.productos
      : [];

  const codigoLider =
    limpiarTexto(
      indicadores?.productoLider
        ?.codigo
    ).toLowerCase();

  const nombreLider =
    limpiarTexto(
      indicadores?.productoLider
        ?.nombre
    ).toLowerCase();

  const producto =
    productos.find(
      (item) => {
        const codigo =
          limpiarTexto(
            item?.codigo
          ).toLowerCase();

        const nombre =
          limpiarTexto(
            item?.descripcion
          ).toLowerCase();

        if (
          codigoLider &&
          codigo &&
          codigo === codigoLider
        ) {
          return true;
        }

        return (
          nombreLider &&
          nombre &&
          nombre === nombreLider
        );
      }
    );

  if (!producto) {
    return null;
  }

  return {
    codigo:
      producto.codigo,

    nombre:
      producto.descripcion,

    existencia:
      convertirNumero(
        producto.existencia
      ),

    piezasVendidas:
      convertirNumero(
        producto.piezasVendidas
      ),

    ventaDiaria:
      convertirNumero(
        producto.ventaDiaria
      ),

    diasCobertura:
      producto.diasCobertura,

    nivelInventario:
      producto.nivelInventario,

    sugerenciaCompra:
      convertirNumero(
        producto.sugerenciaCompra
      ),

    inversionReposicion:
      convertirNumero(
        producto.inversionReposicion
      ),
  };
}

function generarAccionesPrioritarias(
  indicadores,
  inventarioProductoLider = null
) {
  const acciones = [];

  const top =
    indicadores.topProductos || [];

  if (top.length > 0) {
    const lider = top[0];

    if (!inventarioProductoLider) {
      acciones.push({
        prioridad: "MEDIA",
        titulo:
          "Validar inventario del producto líder",
        descripcion:
          `${lider.nombre} vendió ${lider.piezas.toLocaleString(
            "es-MX"
          )} piezas. No fue posible confirmar su existencia actual.`,
        impacto: "ALTO",
        responsable:
          "Director Comercial",
      });
    } else {
      const nivel =
        inventarioProductoLider
          .nivelInventario;

      const existencia =
        inventarioProductoLider
          .existencia;

      const cobertura =
        inventarioProductoLider
          .diasCobertura;

      if (nivel === "NEGATIVO") {
        acciones.push({
          prioridad: "CRITICA",
          titulo:
            "Corregir existencia del producto líder",
          descripcion:
            `${lider.nombre} es el producto líder con ${lider.piezas.toLocaleString(
              "es-MX"
            )} piezas vendidas, pero registra existencia negativa de ${existencia}. Requiere revisión física y administrativa inmediata.`,
          impacto: "ALTO",
          responsable:
            "Director Comercial",
        });
      } else if (
        nivel === "AGOTADO"
      ) {
        acciones.push({
          prioridad: "CRITICA",
          titulo:
            "Reponer producto líder agotado",
          descripcion:
            `${lider.nombre} vendió ${lider.piezas.toLocaleString(
              "es-MX"
            )} piezas y actualmente tiene existencia 0. Existe riesgo directo de perder ventas.`,
          impacto: "ALTO",
          responsable:
            "Director Comercial",
        });
      } else if (
        nivel === "CRITICO"
      ) {
        acciones.push({
          prioridad: "ALTA",
          titulo:
            "Proteger producto líder con cobertura crítica",
          descripcion:
            `${lider.nombre} tiene ${existencia.toLocaleString(
              "es-MX"
            )} piezas disponibles y aproximadamente ${Number(
              cobertura || 0
            ).toFixed(
              1
            )} días de cobertura. Requiere atención prioritaria.`,
          impacto: "ALTO",
          responsable:
            "Director Comercial",
        });
      } else if (
        nivel === "BAJO"
      ) {
        acciones.push({
          prioridad: "ALTA",
          titulo:
            "Reponer producto líder con inventario bajo",
          descripcion:
            `${lider.nombre} tiene ${existencia.toLocaleString(
              "es-MX"
            )} piezas y aproximadamente ${Number(
              cobertura || 0
            ).toFixed(
              1
            )} días de cobertura. Conviene preparar reposición.`,
          impacto: "ALTO",
          responsable:
            "Director Comercial",
        });
      } else if (
        nivel ===
        "SOBREINVENTARIO"
      ) {
        acciones.push({
          prioridad: "MEDIA",
          titulo:
            "Evitar sobrecompra del producto líder",
          descripcion:
            `${lider.nombre} lidera las ventas, pero tiene ${existencia.toLocaleString(
              "es-MX"
            )} piezas y aproximadamente ${Number(
              cobertura || 0
            ).toFixed(
              1
            )} días de cobertura. No conviene aumentar inventario innecesariamente.`,
          impacto: "MEDIO",
          responsable:
            "Director Comercial",
        });
      } else if (
        nivel === "SALUDABLE"
      ) {
        acciones.push({
          prioridad: "BAJA",
          titulo:
            "Mantener disponibilidad del producto líder",
          descripcion:
            `${lider.nombre} tiene inventario saludable: ${existencia.toLocaleString(
              "es-MX"
            )} piezas y aproximadamente ${Number(
              cobertura || 0
            ).toFixed(
              1
            )} días de cobertura.`,
          impacto: "MEDIO",
          responsable:
            "Director Comercial",
        });
      }
    }
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

  const ordenPrioridad = {
    CRITICA: 1,
    ALTA: 2,
    MEDIA: 3,
    BAJA: 4,
  };

  acciones.sort(
    (a, b) =>
      (ordenPrioridad[
        a.prioridad
      ] || 4) -
      (ordenPrioridad[
        b.prioridad
      ] || 4)
  );

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

    const inventarioProductoLider =
  obtenerInventarioProductoLider(
    datosDashboard,
    indicadores
  );
 
    const oportunidades =
  generarOportunidades(
    indicadores,
    inventarioProductoLider
  );

 const recomendaciones =
  generarRecomendaciones(
    indicadores,
    nivelComercial,
    inventarioProductoLider
  );

  const planAccion =
  generarPlanAccion(
    indicadores,
    nivelComercial,
    inventarioProductoLider
  );


const accionesPrioritarias =
  generarAccionesPrioritarias(
    indicadores,
    inventarioProductoLider
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