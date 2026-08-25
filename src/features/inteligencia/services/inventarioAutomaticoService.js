import { supabase } from "../../../supabase";


// ======================================================
// MONYS OS
// MOTOR DE INVENTARIO AUTOMÁTICO
//
// Objetivo:
// - Leer inventario de la sucursal.
// - Detectar negativos.
// - Detectar existencias sospechosas.
// - Detectar faltantes.
// - Detectar productos sin movimiento.
// - Clasificar gravedad.
// - Preparar hallazgos para crear tareas.
// ======================================================


// ======================================================
// UTILIDADES
// ======================================================

function numero(valor) {
  const convertido =
    Number(valor);

  return Number.isFinite(
    convertido
  )
    ? convertido
    : 0;
}


function texto(valor) {
  return String(
    valor || ""
  ).trim();
}


function normalizarTexto(
  valor
) {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    );
}


// ======================================================
// CLASIFICAR PRIORIDAD
// ======================================================

function prioridadPorGravedad(
  gravedad
) {
  if (
    gravedad >= 90
  ) {
    return "critica";
  }

  if (
    gravedad >= 70
  ) {
    return "alta";
  }

  if (
    gravedad >= 40
  ) {
    return "media";
  }

  return "normal";
}


// ======================================================
// NORMALIZAR PRODUCTO
// ======================================================

function normalizarProducto(
  registro
) {
  const existencia =
    numero(
      registro?.existencia ??
      registro?.existencias ??
      registro?.stock ??
      registro?.cantidad ??
      registro?.inventario ??
      0
    );

  const costo =
    numero(
      registro?.costo ??
      registro?.costo_unitario ??
      registro?.ultimo_costo ??
      0
    );

  const precio =
    numero(
      registro?.precio ??
      registro?.precio_venta ??
      registro?.venta ??
      0
    );

  const ventas =
    numero(
      registro?.ventas ??
      registro?.cantidad_vendida ??
      registro?.piezas_vendidas ??
      0
    );

  const nombre =
    texto(
      registro?.producto ??
      registro?.descripcion ??
      registro?.nombre ??
      registro?.articulo ??
      registro?.clave ??
      "Producto sin nombre"
    );

  const codigo =
    texto(
      registro?.codigo ??
      registro?.clave ??
      registro?.sku ??
      registro?.codigo_producto ??
      ""
    );

  return {
    original:
      registro,

    nombre,

    codigo,

    existencia,

    costo,

    precio,

    ventas,

    valorInventario:
      existencia *
      costo,
  };
}


// ======================================================
// DETECTORES
// ======================================================

function detectarInventarioNegativo(
  producto
) {
  if (
    producto.existencia >= 0
  ) {
    return null;
  }

  const gravedad =
    Math.min(
      100,
      80 +
      Math.abs(
        producto.existencia
      ) * 2
    );

  return {
    tipo:
      "INVENTARIO_NEGATIVO",

    titulo:
      `Inventario negativo: ${producto.nombre}`,

    descripcion:
      `MONYS detectó existencia negativa de ${producto.existencia} unidades. Esto puede indicar errores de captura, ventas no descontadas correctamente, compras no registradas o diferencias físicas.`,

    prioridad:
      prioridadPorGravedad(
        gravedad
      ),

    gravedad,

    requiereRevisionFisica:
      true,

    producto:
      producto.nombre,

    codigo:
      producto.codigo,

    existencia:
      producto.existencia,

    valorInventario:
      producto.valorInventario,
  };
}


function detectarFaltante(
  producto
) {
  if (
    producto.existencia > 0
  ) {
    return null;
  }

  if (
    producto.ventas <= 0
  ) {
    return null;
  }

  const gravedad =
    producto.ventas >= 10
      ? 85
      : producto.ventas >= 5
      ? 75
      : 65;

  return {
    tipo:
      "FALTANTE_CON_DEMANDA",

    titulo:
      `Revisar faltante: ${producto.nombre}`,

    descripcion:
      `El producto tiene existencia ${producto.existencia} y registra ventas. MONYS detecta riesgo de pérdida de ventas por falta de disponibilidad.`,

    prioridad:
      prioridadPorGravedad(
        gravedad
      ),

    gravedad,

    requiereRevisionFisica:
      true,

    producto:
      producto.nombre,

    codigo:
      producto.codigo,

    existencia:
      producto.existencia,

    ventas:
      producto.ventas,

    valorInventario:
      producto.valorInventario,
  };
}


function detectarExistenciaSospechosa(
  producto
) {
  /*
    Primera versión prudente.

    No declaramos que el inventario
    está mal: solo marcamos para revisión
    cantidades extremadamente altas.
  */

  if (
    producto.existencia < 500
  ) {
    return null;
  }

  const gravedad =
    producto.existencia >= 2000
      ? 80
      : producto.existencia >= 1000
      ? 65
      : 45;

  return {
    tipo:
      "EXISTENCIA_SOSPECHOSA",

    titulo:
      `Revisar existencia alta: ${producto.nombre}`,

    descripcion:
      `MONYS detectó una existencia de ${producto.existencia} unidades. La cantidad es inusualmente alta y conviene confirmar físicamente que el dato de SICAR sea correcto.`,

    prioridad:
      prioridadPorGravedad(
        gravedad
      ),

    gravedad,

    requiereRevisionFisica:
      true,

    producto:
      producto.nombre,

    codigo:
      producto.codigo,

    existencia:
      producto.existencia,

    valorInventario:
      producto.valorInventario,
  };
}


function detectarSobreinventarioSimple(
  producto
) {
  if (
    producto.existencia <= 0 ||
    producto.ventas > 0
  ) {
    return null;
  }

  if (
    producto.valorInventario <
    1000
  ) {
    return null;
  }

  const gravedad =
    producto.valorInventario >=
    10000
      ? 75
      : producto.valorInventario >=
        5000
      ? 60
      : 45;

  return {
    tipo:
      "SOBREINVENTARIO_SIN_MOVIMIENTO",

    titulo:
      `Inventario sin movimiento: ${producto.nombre}`,

    descripcion:
      `MONYS detectó inventario con valor aproximado de $${producto.valorInventario.toFixed(
        2
      )} sin ventas registradas en los datos analizados. Conviene revisar rotación, traspaso, promoción o posible error de inventario.`,

    prioridad:
      prioridadPorGravedad(
        gravedad
      ),

    gravedad,

    requiereRevisionFisica:
      false,

    producto:
      producto.nombre,

    codigo:
      producto.codigo,

    existencia:
      producto.existencia,

    ventas:
      producto.ventas,

    valorInventario:
      producto.valorInventario,
  };
}


// ======================================================
// ANALIZAR UN PRODUCTO
// ======================================================

function analizarProducto(
  registro
) {
  const producto =
    normalizarProducto(
      registro
    );

  const hallazgos =
    [
      detectarInventarioNegativo(
        producto
      ),

      detectarFaltante(
        producto
      ),

      detectarExistenciaSospechosa(
        producto
      ),

      detectarSobreinventarioSimple(
        producto
      ),
    ].filter(Boolean);

  return {
    producto,
    hallazgos,
  };
}


// ======================================================
// ANALIZAR LISTA COMPLETA
// ======================================================

export function analizarInventarioAutomaticamente(
  registros = []
) {
  const lista =
    Array.isArray(registros)
      ? registros
      : [];

  const productosAnalizados =
    [];

  const hallazgos =
    [];

  lista.forEach(
    (registro) => {
      const resultado =
        analizarProducto(
          registro
        );

      productosAnalizados.push(
        resultado.producto
      );

      hallazgos.push(
        ...resultado.hallazgos
      );
    }
  );


  hallazgos.sort(
    (a, b) =>
      b.gravedad -
      a.gravedad
  );


  const negativos =
    hallazgos.filter(
      (hallazgo) =>
        hallazgo.tipo ===
        "INVENTARIO_NEGATIVO"
    );

  const faltantes =
    hallazgos.filter(
      (hallazgo) =>
        hallazgo.tipo ===
        "FALTANTE_CON_DEMANDA"
    );

  const sospechosos =
    hallazgos.filter(
      (hallazgo) =>
        hallazgo.tipo ===
        "EXISTENCIA_SOSPECHOSA"
    );

  const sobreinventario =
    hallazgos.filter(
      (hallazgo) =>
        hallazgo.tipo ===
        "SOBREINVENTARIO_SIN_MOVIMIENTO"
    );


  const valorInventario =
    productosAnalizados.reduce(
      (
        total,
        producto
      ) =>
        total +
        Math.max(
          0,
          producto.valorInventario
        ),
      0
    );


  return {
    totalProductos:
      productosAnalizados.length,

    totalHallazgos:
      hallazgos.length,

    totalNegativos:
      negativos.length,

    totalFaltantes:
      faltantes.length,

    totalSospechosos:
      sospechosos.length,

    totalSobreinventario:
      sobreinventario.length,

    valorInventario,

    productos:
      productosAnalizados,

    hallazgos,

    negativos,

    faltantes,

    sospechosos,

    sobreinventario,
  };
}


// ======================================================
// LEER ÚLTIMO INVENTARIO DESDE SUPABASE
// ======================================================

export async function obtenerUltimoInventarioAutomatico({
  branchId,
} = {}) {
  if (!branchId) {
    throw new Error(
      "Falta branch_id para analizar inventario."
    );
  }


  /*
    Primero intentamos leer la tabla
    inventario_existencias, que ya existe
    en tu proyecto.
  */

  const {
    data,
    error,
  } = await supabase
    .from(
      "inventario_existencias"
    )
    .select("*")
    .eq(
      "branch_id",
      branchId
    );


  if (error) {
    console.error(
      "Error al obtener inventario:",
      error
    );

    throw error;
  }


  return Array.isArray(data)
    ? data
    : [];
}


// ======================================================
// EJECUTAR ANÁLISIS COMPLETO
// ======================================================

export async function ejecutarAnalisisInventarioAutomatico({
  branchId,
} = {}) {
  const registros =
    await obtenerUltimoInventarioAutomatico({
      branchId,
    });


  const analisis =
    analizarInventarioAutomaticamente(
      registros
    );


  return {
    ok:
      true,

    branchId,

    ...analisis,
  };
}


// ======================================================
// CONVERTIR HALLAZGOS EN PRIORIDADES OPERATIVAS
// ======================================================

export function convertirHallazgosInventarioEnPrioridades(
  hallazgos = []
) {
  const lista =
    Array.isArray(
      hallazgos
    )
      ? hallazgos
      : [];


  return lista.map(
    (
      hallazgo,
      indice
    ) => ({
      id:
        `inventario-${indice}-${normalizarTexto(
          hallazgo.producto
        ).replace(
          /\s+/g,
          "-"
        )}`,

      titulo:
        hallazgo.titulo,

      descripcion:
        hallazgo.descripcion,

      prioridad:
        hallazgo.prioridad,

      impacto:
        hallazgo.gravedad >= 70
          ? "ALTO"
          : hallazgo.gravedad >= 40
          ? "MEDIO"
          : "BAJO",

      origen:
        "INVENTARIO_AUTOMATICO",

      origenTexto:
        "Inventario automático",

      responsable:
        "Operación",

      confianza:
        hallazgo.tipo ===
          "INVENTARIO_NEGATIVO"
          ? 95
          : hallazgo.tipo ===
            "FALTANTE_CON_DEMANDA"
          ? 85
          : 70,

      requiereAtencion:
        hallazgo.gravedad >=
        70,

      metadata: {
        tipo:
          hallazgo.tipo,

        producto:
          hallazgo.producto,

        codigo:
          hallazgo.codigo,

        existencia:
          hallazgo.existencia,

        ventas:
          hallazgo.ventas,

        valorInventario:
          hallazgo.valorInventario,

        requiereRevisionFisica:
          hallazgo.requiereRevisionFisica,
      },
    })
  );
}