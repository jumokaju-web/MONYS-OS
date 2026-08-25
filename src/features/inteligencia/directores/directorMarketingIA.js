function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function obtenerNivelPrioridad(
  valor
) {
  if (valor === "CRITICA") {
    return 1;
  }

  if (valor === "ALTA") {
    return 2;
  }

  if (valor === "MEDIA") {
    return 3;
  }

  return 4;
}

export function directorMarketingIA({
  analisisComercial = null,
  analisisInventario = null,
  analisisFinanciero = null,
} = {}) {
  const indicadoresComerciales =
    analisisComercial?.indicadores || {};

  const topProductos =
    Array.isArray(
      analisisComercial?.topProductos
    )
      ? analisisComercial.topProductos
      : [];

  const categorias =
    Array.isArray(
      analisisComercial?.categorias
    )
      ? analisisComercial.categorias
      : [];

  const productosInventario =
    Array.isArray(
      analisisInventario?.productos
    )
      ? analisisInventario.productos
      : [];

  const sobreinventario =
    Array.isArray(
      analisisInventario
        ?.sobreinventario
    )
      ? analisisInventario
          .sobreinventario
      : [];

  const ventasTotales =
    convertirNumero(
      indicadoresComerciales
        ?.ventasTotales
    );

  const utilidadTotal =
    convertirNumero(
      indicadoresComerciales
        ?.utilidadTotal
    );

  const margenUtilidad =
    convertirNumero(
      indicadoresComerciales
        ?.margenUtilidad
    );

  const capacidadCompra =
    convertirNumero(
      analisisFinanciero
        ?.capacidadCompra
    );

  const vencimientos30Dias =
    convertirNumero(
      analisisFinanciero
        ?.vencimientos30Dias
    );

  const productoLider =
    topProductos[0] || null;

  const categoriaLider =
    categorias[0] || null;

  const buscarInventarioProducto = (
    producto
  ) => {
    if (!producto) {
      return null;
    }

    const codigo =
      String(
        producto.codigo || ""
      )
        .trim()
        .toLowerCase();

    const nombre =
      String(
        producto.nombre || ""
      )
        .trim()
        .toLowerCase();

    return (
      productosInventario.find(
        (item) => {
          const codigoInventario =
            String(
              item.codigo || ""
            )
              .trim()
              .toLowerCase();

          const nombreInventario =
            String(
              item.descripcion || ""
            )
              .trim()
              .toLowerCase();

          if (
            codigo &&
            codigoInventario &&
            codigo ===
              codigoInventario
          ) {
            return true;
          }

          return (
            nombre &&
            nombreInventario &&
            nombre ===
              nombreInventario
          );
        }
      ) || null
    );
  };

  const inventarioProductoLider =
    buscarInventarioProducto(
      productoLider
    );

  const oportunidades = [];

  if (
    productoLider &&
    inventarioProductoLider
  ) {
    const nivel =
      inventarioProductoLider
        .nivelInventario;

    const existencia =
      convertirNumero(
        inventarioProductoLider
          .existencia
      );

    const cobertura =
      convertirNumero(
        inventarioProductoLider
          .diasCobertura
      );

    if (
      nivel ===
      "SOBREINVENTARIO"
    ) {
      oportunidades.push({
        prioridad: "ALTA",
        tipo: "ROTACION",
        titulo:
          "Campaña para acelerar rotación del producto líder",
        descripcion:
          `${productoLider.nombre} lidera las ventas y tiene ${existencia.toLocaleString(
            "es-MX"
          )} piezas, equivalentes a aproximadamente ${cobertura.toFixed(
            1
          )} días de cobertura. Conviene impulsar su salida antes de volver a comprar.`,
        producto:
          productoLider.nombre,
      });
    } else if (
      nivel === "SALUDABLE"
    ) {
      oportunidades.push({
        prioridad: "MEDIA",
        tipo: "IMPULSO",
        titulo:
          "Mantener visibilidad del producto líder",
        descripcion:
          `${productoLider.nombre} mantiene inventario saludable y buen desempeño comercial. Puede conservarse como producto destacado sin aumentar inventario.`,
        producto:
          productoLider.nombre,
      });
    } else if (
      nivel === "AGOTADO" ||
      nivel === "CRITICO" ||
      nivel === "BAJO"
    ) {
      oportunidades.push({
        prioridad: "ALTA",
        tipo: "PROTECCION",
        titulo:
          "Evitar campaña que acelere un posible agotamiento",
        descripcion:
          `${productoLider.nombre} tiene demanda alta pero inventario limitado. No conviene aumentar publicidad hasta asegurar disponibilidad.`,
        producto:
          productoLider.nombre,
      });
    }
  }

  const candidatosSobreinventario =
    sobreinventario
      .filter(
        (producto) =>
          convertirNumero(
            producto.existencia
          ) > 0
      )
      .slice(0, 5);

  for (
    const producto of
    candidatosSobreinventario
  ) {
    oportunidades.push({
      prioridad: "MEDIA",
      tipo: "DESPLAZAMIENTO",
      titulo:
        `Mover inventario de ${producto.descripcion}`,
      descripcion:
        `${producto.descripcion} tiene aproximadamente ${convertirNumero(
          producto.diasCobertura
        ).toFixed(
          1
        )} días de cobertura. Puede evaluarse una campaña de rotación, exhibición especial o paquete promocional sin aumentar compras.`,
      producto:
        producto.descripcion,
    });
  }

  if (categoriaLider) {
    oportunidades.push({
      prioridad: "MEDIA",
      tipo: "CATEGORIA",
      titulo:
        "Impulsar categoría con mayor movimiento",
      descripcion:
        `${categoriaLider.categoria} lidera el periodo con ${convertirNumero(
          categoriaLider.piezas
        ).toLocaleString(
          "es-MX"
        )} piezas vendidas. Conviene analizar exhibición, contenido y campañas para esta categoría.`,
      categoria:
        categoriaLider.categoria,
    });
  }

  const presupuestoDisponible =
    Math.max(
      0,
      capacidadCompra
    );

  const estadoFinancieroMarketing =
    vencimientos30Dias > 0 &&
    presupuestoDisponible <= 0
      ? "SIN_PRESUPUESTO"
      : presupuestoDisponible > 0
      ? "CON_PRESUPUESTO"
      : "LIMITADO";

  const recomendaciones = [];

  if (
    estadoFinancieroMarketing ===
    "SIN_PRESUPUESTO"
  ) {
    recomendaciones.push(
      "Priorizar campañas orgánicas, exhibición, contenido, bundles y acciones de rotación que no requieran nuevas compras ni inversión adicional."
    );
  }

  if (
    margenUtilidad >= 35
  ) {
    recomendaciones.push(
      "El margen comercial es favorable; evita descuentos agresivos que reduzcan innecesariamente la rentabilidad."
    );
  }

  if (
    candidatosSobreinventario.length >
    0
  ) {
    recomendaciones.push(
      "Usar Marketing para acelerar la salida del sobreinventario antes de destinar presupuesto a nuevas compras."
    );
  }

  if (categoriaLider) {
    recomendaciones.push(
      `Dar mayor visibilidad a la categoría ${categoriaLider.categoria}, cuidando no generar demanda sobre productos con inventario crítico.`
    );
  }

  const accionesPrioritarias =
    [...oportunidades]
      .sort(
        (a, b) =>
          obtenerNivelPrioridad(
            a.prioridad
          ) -
          obtenerNivelPrioridad(
            b.prioridad
          )
      )
      .slice(0, 5);

  let estadoGeneral =
    "Marketing estable";

  if (
    estadoFinancieroMarketing ===
    "SIN_PRESUPUESTO"
  ) {
    estadoGeneral =
      "Marketing enfocado en rotación sin gasto";
  } else if (
    candidatosSobreinventario.length >
    0
  ) {
    estadoGeneral =
      "Oportunidad de acelerar rotación";
  }

  return {
    nombre:
      "Director Marketing IA",

    version:
      "1.0.0",

    estadoGeneral,

    ventasTotales,

    utilidadTotal,

    margenUtilidad,

    capacidadCompra:
      presupuestoDisponible,

    vencimientos30Dias,

    estadoFinancieroMarketing,

    productoLider,

    inventarioProductoLider,

    categoriaLider,

    sobreinventarioDetectado:
      candidatosSobreinventario,

    oportunidades,

    recomendaciones,

    accionesPrioritarias,

    generadoEn:
      new Date().toISOString(),
  };
}