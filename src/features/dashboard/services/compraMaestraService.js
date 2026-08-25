import {
  obtenerUltimosInventariosPorSucursal,
  obtenerUltimasVentasPorSucursal,
} from "../../dashboard/services/dashboardDataService";

import {
  obtenerSucursalesInventario,
} from "./inventarioService";

import {
  generarRecomendacionesRebalanceo,
} from "./rebalanceoInventarioService";

const DIAS_COBERTURA_OBJETIVO = 30;

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

function normalizarTexto(valor) {
  return limpiarTexto(valor)
    .toLowerCase();
}

function obtenerDatosOriginales(
  detalle
) {
  return detalle?.datos_originales || {};
}

function obtenerCodigo(
  detalle
) {
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

function obtenerDescripcion(
  detalle
) {
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

function obtenerCategoria(
  detalle
) {
  const originales =
    obtenerDatosOriginales(detalle);

  return limpiarTexto(
    detalle?.categoria ??
      originales.categoria ??
      originales.departamento ??
      "Sin categoría"
  );
}

function obtenerExistencia(
  detalle
) {
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

function obtenerPrecioCompra(
  detalle
) {
  const originales =
    obtenerDatosOriginales(detalle);

  return Math.max(
    0,
    convertirNumero(
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
    )
  );
}

function obtenerCantidadVendida(
  venta
) {
  const originales =
    obtenerDatosOriginales(venta);

  return Math.max(
    0,
    convertirNumero(
      venta?.cantidad ??
        venta?.piezas ??
        venta?.unidades ??
        originales.cantidad ??
        originales.cant ??
        originales.piezas ??
        originales.unidades ??
        0
    )
  );
}

function crearLlaveProducto(
  producto
) {
  const codigo =
    normalizarTexto(
      obtenerCodigo(producto)
    );

  if (codigo) {
    return `codigo:${codigo}`;
  }

  const descripcion =
    normalizarTexto(
      obtenerDescripcion(producto)
    );

  if (descripcion) {
    return `descripcion:${descripcion}`;
  }

  return "";
}

function obtenerNombreSucursal(
  sucursales,
  branchId
) {
  const sucursal =
    (sucursales || []).find(
      (item) =>
        String(item?.id) ===
        String(branchId)
    );

  return (
    sucursal?.name ||
    "Sucursal"
  );
}

function obtenerDiasAnalizados(
  ventasSucursal
) {
  const dias =
    convertirNumero(
      ventasSucursal?.periodo
        ?.diasAnalizados
    );

  return dias > 0
    ? dias
    : 0;
}

function construirMapaVentas(
  ventas = []
) {
  const mapa = new Map();

  for (const venta of ventas || []) {
    const llave =
      crearLlaveProducto(venta);

    if (!llave) {
      continue;
    }

    const actual =
      mapa.get(llave) || {
        piezasVendidas: 0,
      };

    actual.piezasVendidas +=
      obtenerCantidadVendida(
        venta
      );

    mapa.set(
      llave,
      actual
    );
  }

  return mapa;
}

function construirMapaInventario(
  detalles = []
) {
  const mapa = new Map();

  for (
    const detalle of
    detalles || []
  ) {
    const llave =
      crearLlaveProducto(
        detalle
      );

    if (!llave) {
      continue;
    }

    const existencia =
      obtenerExistencia(
        detalle
      );

    const actual =
      mapa.get(llave);

    /*
      Si hubiera un producto repetido
      en el reporte, conservamos el
      registro con mayor existencia.

      Evita duplicar necesidades.
    */
    if (
      !actual ||
      existencia >
        actual.existencia
    ) {
      mapa.set(llave, {
        llave,

        codigo:
          obtenerCodigo(
            detalle
          ),

        descripcion:
          obtenerDescripcion(
            detalle
          ),

        categoria:
          obtenerCategoria(
            detalle
          ),

        existencia,

        precioCompra:
          obtenerPrecioCompra(
            detalle
          ),
      });
    }
  }

  return mapa;
}

function obtenerLlaveRecomendacion(
  recomendacion
) {
  const codigo =
    normalizarTexto(
      recomendacion?.codigo
    );

  if (codigo) {
    return `codigo:${codigo}`;
  }

  const productId =
    normalizarTexto(
      recomendacion?.productId
    );

  if (productId) {
    if (
      productId.startsWith(
        "codigo:"
      ) ||
      productId.startsWith(
        "descripcion:"
      )
    ) {
      return productId;
    }
  }

  const descripcion =
    normalizarTexto(
      recomendacion?.descripcion
    );

  if (descripcion) {
    return `descripcion:${descripcion}`;
  }

  return "";
}

function construirMapaTraspasosEntrantes(
  recomendaciones = []
) {
  const mapa = new Map();

  for (
    const recomendacion of
    recomendaciones || []
  ) {
    const branchDestinoId =
      recomendacion
        ?.branchDestinoId;

    const llave =
      obtenerLlaveRecomendacion(
        recomendacion
      );

    const cantidad =
      Math.max(
        0,
        convertirNumero(
          recomendacion
            ?.cantidadSugerida
        )
      );

    if (
      !branchDestinoId ||
      !llave ||
      cantidad <= 0
    ) {
      continue;
    }

    const claveMapa =
      `${branchDestinoId}|${llave}`;

    mapa.set(
      claveMapa,
      (
        mapa.get(claveMapa) ||
        0
      ) + cantidad
    );
  }

  return mapa;
}

function calcularNecesidadSucursal({
  producto,
  piezasVendidas,
  diasAnalizados,
  traspasoDisponible,
}) {
  const existencia =
    convertirNumero(
      producto?.existencia
    );

  const precioCompra =
    Math.max(
      0,
      convertirNumero(
        producto?.precioCompra
      )
    );

  if (
    diasAnalizados <= 0 ||
    piezasVendidas <= 0
  ) {
    return {
      ventaDiaria: 0,

      coberturaActual: null,

      existenciaObjetivo: 0,

      necesidadAntesTraspaso: 0,

      cubiertoPorTraspaso: 0,

      cantidadComprar: 0,

      coberturaDespuesCompra:
        null,

      inversionEstimada: 0,
    };
  }

  const ventaDiaria =
    piezasVendidas /
    diasAnalizados;

  const coberturaActual =
    existencia > 0
      ? existencia /
        ventaDiaria
      : 0;

  const existenciaObjetivo =
    ventaDiaria *
    DIAS_COBERTURA_OBJETIVO;

  const necesidadAntesTraspaso =
    Math.max(
      0,
      Math.ceil(
        existenciaObjetivo -
        Math.max(
          0,
          existencia
        )
      )
    );

  const cubiertoPorTraspaso =
    Math.min(
      necesidadAntesTraspaso,
      Math.max(
        0,
        convertirNumero(
          traspasoDisponible
        )
      )
    );

  const cantidadComprar =
    Math.max(
      0,
      necesidadAntesTraspaso -
        cubiertoPorTraspaso
    );

  const existenciaProyectada =
    Math.max(
      0,
      existencia
    ) +
    cubiertoPorTraspaso +
    cantidadComprar;

  const coberturaDespuesCompra =
    ventaDiaria > 0
      ? existenciaProyectada /
        ventaDiaria
      : null;

  return {
    ventaDiaria,

    coberturaActual,

    existenciaObjetivo,

    necesidadAntesTraspaso,

    cubiertoPorTraspaso,

    cantidadComprar,

    coberturaDespuesCompra,

    inversionEstimada:
      cantidadComprar *
      precioCompra,
  };
}

export async function generarCompraMaestra() {
  const [
    inventariosPorSucursal,
    ventasPorSucursal,
    sucursales,
    recomendacionesRebalanceo,
  ] = await Promise.all([
    obtenerUltimosInventariosPorSucursal(),

    obtenerUltimasVentasPorSucursal(),

    obtenerSucursalesInventario(),

    generarRecomendacionesRebalanceo(),
  ]);

  const mapaVentasPorSucursal =
    new Map();

  for (
    const ventasSucursal of
    ventasPorSucursal || []
  ) {
    mapaVentasPorSucursal.set(
      String(
        ventasSucursal.branch_id
      ),
      ventasSucursal
    );
  }

  const mapaTraspasosEntrantes =
    construirMapaTraspasosEntrantes(
      recomendacionesRebalanceo
    );

  const productosConsolidados =
    new Map();

  for (
    const inventarioSucursal of
    inventariosPorSucursal || []
  ) {
    const branchId =
      inventarioSucursal?.branch_id;

    if (!branchId) {
      continue;
    }

    const ventasSucursal =
      mapaVentasPorSucursal.get(
        String(branchId)
      );

    if (!ventasSucursal) {
      continue;
    }

    const diasAnalizados =
      obtenerDiasAnalizados(
        ventasSucursal
      );

    if (diasAnalizados <= 0) {
      continue;
    }

    const mapaVentas =
      construirMapaVentas(
        ventasSucursal?.ventas ||
          []
      );

    const mapaInventario =
      construirMapaInventario(
        inventarioSucursal?.detalles ||
          []
      );

    const nombreSucursal =
      obtenerNombreSucursal(
        sucursales,
        branchId
      );

    for (
      const [
        llave,
        producto,
      ] of mapaInventario
    ) {
      const ventasProducto =
        mapaVentas.get(
          llave
        );

      const piezasVendidas =
        convertirNumero(
          ventasProducto
            ?.piezasVendidas
        );

      /*
        No recomendamos compra
        de productos sin demanda.
      */
      if (
        piezasVendidas <= 0
      ) {
        continue;
      }

      const claveTraspaso =
        `${branchId}|${llave}`;

      const traspasoDisponible =
        mapaTraspasosEntrantes.get(
          claveTraspaso
        ) || 0;

      const calculo =
        calcularNecesidadSucursal({
          producto,

          piezasVendidas,

          diasAnalizados,

          traspasoDisponible,
        });

      /*
        Si la sucursal ya tiene
        suficiente inventario,
        no entra a Compra Maestra.
      */
      if (
        calculo
          .necesidadAntesTraspaso <=
        0
      ) {
        continue;
      }

      const detalleSucursal = {
        branchId,

        sucursal:
          nombreSucursal,

        existenciaActual:
          producto.existencia,

        piezasVendidas,

        diasAnalizados,

        ventaDiaria:
          calculo.ventaDiaria,

        coberturaActual:
          calculo.coberturaActual,

        coberturaObjetivo:
          DIAS_COBERTURA_OBJETIVO,

        necesidadAntesTraspaso:
          calculo
            .necesidadAntesTraspaso,

        cubiertoPorTraspaso:
          calculo
            .cubiertoPorTraspaso,

        cantidadComprar:
          calculo
            .cantidadComprar,

        coberturaDespuesCompra:
          calculo
            .coberturaDespuesCompra,

        inversionEstimada:
          calculo
            .inversionEstimada,
      };

      const actual =
        productosConsolidados.get(
          llave
        ) || {
          llave,

          codigo:
            producto.codigo,

          descripcion:
            producto.descripcion,

          categoria:
            producto.categoria,

          precioCompra:
            producto.precioCompra,

          compraTotal: 0,

          necesidadTotalAntesTraspasos:
            0,

          cubiertoPorTraspasos:
            0,

          inversionTotal: 0,

          sucursales: [],
        };

      actual
        .necesidadTotalAntesTraspasos +=
        calculo
          .necesidadAntesTraspaso;

      actual
        .cubiertoPorTraspasos +=
        calculo
          .cubiertoPorTraspaso;

      actual.compraTotal +=
        calculo.cantidadComprar;

      actual.inversionTotal +=
        calculo.inversionEstimada;

      actual.sucursales.push(
        detalleSucursal
      );

      /*
        Si el producto no tenía
        precio pero otra sucursal sí,
        conservamos el precio disponible.
      */
      if (
        actual.precioCompra <= 0 &&
        producto.precioCompra > 0
      ) {
        actual.precioCompra =
          producto.precioCompra;
      }

      productosConsolidados.set(
        llave,
        actual
      );
    }
  }

  const productos =
    Array.from(
      productosConsolidados.values()
    )
      .filter(
        (producto) =>
          producto.compraTotal >
          0
      )
      .sort(
        (a, b) => {
          if (
            b.compraTotal !==
            a.compraTotal
          ) {
            return (
              b.compraTotal -
              a.compraTotal
            );
          }

          return (
            b.inversionTotal -
            a.inversionTotal
          );
        }
      );

  const totalPiezasComprar =
    productos.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto.compraTotal
        ),
      0
    );

  const totalNecesidadAntesTraspasos =
    productos.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto
            .necesidadTotalAntesTraspasos
        ),
      0
    );

  const totalCubiertoPorTraspasos =
    productos.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto
            .cubiertoPorTraspasos
        ),
      0
    );

  const inversionTotal =
    productos.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto.inversionTotal
        ),
      0
    );

  return {
    coberturaObjetivoDias:
      DIAS_COBERTURA_OBJETIVO,

    totalProductosComprar:
      productos.length,

    totalPiezasComprar,

    totalNecesidadAntesTraspasos,

    totalCubiertoPorTraspasos,

    inversionTotal,

    productos,
  };
}

generarCompraMaestra()
  .then((resultado) => {
    console.log(
      "COMPRA MAESTRA:",
      resultado
    );
  })
  .catch((error) => {
    console.error(
      "ERROR COMPRA MAESTRA:",
      error
    );
  });