import { supabase } from "../../../supabase";

async function obtenerDetallesPaginados(
  importacionId,
  mensajeError
) {
  const detalles = [];
  const tamanoLote = 1000;
  let inicio = 0;

  while (true) {
    const fin =
      inicio + tamanoLote - 1;

    const {
      data: lote,
      error,
    } = await supabase
      .from("importacion_detalle")
      .select(
        "id, numero_fila, codigo, descripcion, categoria, cantidad, datos_originales"
      )
      .eq(
        "importacion_id",
        importacionId
      )
      .order("numero_fila", {
        ascending: true,
      })
      .range(inicio, fin);

    if (error) {
      throw new Error(
        `${mensajeError}: ${error.message}`
      );
    }

    const filasRecibidas =
      lote || [];

    detalles.push(
      ...filasRecibidas
    );

    if (
      filasRecibidas.length <
      tamanoLote
    ) {
      break;
    }

    inicio += tamanoLote;
  }

  return detalles;
}

async function obtenerVentasArticulosPaginadas(
  importacionId
) {
  const ventas = [];
  const tamanoLote = 1000;
  let inicio = 0;

  while (true) {
    const fin =
      inicio + tamanoLote - 1;

    const {
      data: lote,
      error,
    } = await supabase
      .from("ventas_articulos")
      .select(`
        id,
        importacion_id,
        codigo,
        descripcion,
        categoria,
        cantidad,
        costo,
        importe,
        descuento,
        utilidad,
        sucursal,
        fecha,
        folio_venta
      `)
      .eq(
        "importacion_id",
        importacionId
      )
      .order("id", {
        ascending: true,
      })
      .range(inicio, fin);

    if (error) {
      throw new Error(
        `No se pudieron consultar las ventas reales: ${error.message}`
      );
    }

    const filasRecibidas =
      lote || [];

    ventas.push(
      ...filasRecibidas
    );

    if (
      filasRecibidas.length <
      tamanoLote
    ) {
      break;
    }

    inicio += tamanoLote;
  }

  return ventas;
}

function convertirFechaValida(valor) {
  if (!valor) {
    return null;
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return null;
  }

  return fecha;
}

function construirPeriodo(
  fechaInicioValor,
  fechaFinValor
) {
  const fechaInicio =
    convertirFechaValida(
      fechaInicioValor
    );

  const fechaFin =
    convertirFechaValida(
      fechaFinValor
    );

  if (
    !fechaInicio ||
    !fechaFin
  ) {
    return null;
  }

  const milisegundosDia =
    1000 * 60 * 60 * 24;

  const diasAnalizados =
    Math.floor(
      (
        fechaFin.getTime() -
        fechaInicio.getTime()
      ) / milisegundosDia
    ) + 1;

  if (diasAnalizados <= 0) {
    return null;
  }

  return {
    fechaInicio:
      fechaInicio.toISOString(),

    fechaFin:
      fechaFin.toISOString(),

    diasAnalizados,
  };
}

function obtenerPeriodoDesdeDetalles(
  detalles = []
) {
  for (const detalle of detalles) {
    const datosOriginales =
      detalle?.datos_originales ||
      {};

    const periodo =
      construirPeriodo(
        datosOriginales.periodoInicio,
        datosOriginales.periodoFin
      );

    if (periodo) {
      return periodo;
    }
  }

  return null;
}

function obtenerPeriodoDesdeVentas(
  ventas = []
) {
  let fechaInicio = null;
  let fechaFin = null;

  for (const venta of ventas) {
    const fecha =
      convertirFechaValida(
        venta?.fecha
      );

    if (!fecha) {
      continue;
    }

    if (
      !fechaInicio ||
      fecha < fechaInicio
    ) {
      fechaInicio = fecha;
    }

    if (
      !fechaFin ||
      fecha > fechaFin
    ) {
      fechaFin = fecha;
    }
  }

  if (
    !fechaInicio ||
    !fechaFin
  ) {
    return null;
  }

  return construirPeriodo(
    fechaInicio,
    fechaFin
  );
}

export async function obtenerVentasArticulosPorImportacion(
  importacionId
) {
  if (!importacionId) {
    return [];
  }

  return obtenerVentasArticulosPaginadas(
    importacionId
  );
}

export async function obtenerUltimaImportacionVentas(
  branchId = null
) {

 
  let consulta = supabase
    .from("importaciones")
    .select(
      "id, tipo_reporte, archivo_original, total_filas, branch_id, created_at"
    )
    .eq(
      "tipo_reporte",
      "Ventas por artículo"
    )
    .eq(
      "estado",
      "procesado"
    );

  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  }

  const {
    data: importacion,
    error,
  } = await consulta
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la última importación de ventas: ${error.message}`
    );
  }

  if (!importacion) {
    return null;
  }


  const detalles =
    await obtenerDetallesPaginados(
      importacion.id,
      "No se pudieron consultar los detalles de ventas"
    );

  const ventasReales =
    await obtenerVentasArticulosPorImportacion(
      importacion.id
    );

  return {
    importacion,
    detalles,
    ventasReales,
  };
}

export async function obtenerUltimaImportacionUtilidadVentas(
  branchId = null
) {
  let consulta = supabase
    .from("importaciones")
    .select(
      "id, tipo_reporte, archivo_original, total_filas, branch_id, created_at"
    )
    .eq(
      "tipo_reporte",
      "Utilidad de ventas"
    )
    .eq(
      "estado",
      "procesado"
    );

  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  }

  const {
    data: importacion,
    error,
  } = await consulta
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la última importación de utilidad: ${error.message}`
    );
  }

  if (!importacion) {
    return null;
  }

  const detalles =
    await obtenerDetallesPaginados(
      importacion.id,
      "No se pudieron consultar los detalles de utilidad"
    );

  return {
    importacion,
    detalles,
  };
}

export async function obtenerUltimaImportacionInventario(
  branchId = null
) {
  let consulta = supabase
    .from("importaciones")
    .select(
      "id, tipo_reporte, archivo_original, total_filas, branch_id, created_at"
    )
    .in("tipo_reporte", [
      "Inventario",
      "Inventario / Utilidad",
      "Existencias",
    ])
    .eq(
      "estado",
      "procesado"
    );

  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  }

  const {
    data: importacion,
    error,
  } = await consulta
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la última importación de inventario: ${error.message}`
    );
  }

  if (!importacion) {
    return null;
  }

  const detalles =
    await obtenerDetallesPaginados(
      importacion.id,
      "No se pudieron consultar los detalles de inventario"
    );

  return {
    importacion,
    detalles,
  };
}

export async function obtenerUltimosInventariosPorSucursal() {
  const {
    data: importaciones,
    error,
  } = await supabase
    .from("importaciones")
    .select(`
      id,
      tipo_reporte,
      archivo_original,
      total_filas,
      branch_id,
      created_at
    `)
    .in("tipo_reporte", [
      "Inventario",
      "Inventario / Utilidad",
      "Existencias",
    ])
    .eq(
      "estado",
      "procesado"
    )
    .not(
      "branch_id",
      "is",
      null
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `No se pudieron consultar los inventarios por sucursal: ${error.message}`
    );
  }

  const ultimasPorSucursal = [];

  const sucursalesProcesadas =
    new Set();

  for (
    const importacion of
    importaciones || []
  ) {
    if (
      !importacion.branch_id ||
      sucursalesProcesadas.has(
        importacion.branch_id
      )
    ) {
      continue;
    }

    sucursalesProcesadas.add(
      importacion.branch_id
    );

    const detalles =
      await obtenerDetallesPaginados(
        importacion.id,
        `No se pudieron consultar los detalles del inventario ${importacion.branch_id}`
      );

    ultimasPorSucursal.push({
      importacion,

      branch_id:
        importacion.branch_id,

      detalles,
    });
  }

  return ultimasPorSucursal;
}

export async function obtenerUltimasVentasPorSucursal() {
  const {
    data: importaciones,
    error,
  } = await supabase
    .from("importaciones")
    .select(`
      id,
      tipo_reporte,
      archivo_original,
      branch_id,
      created_at
    `)
    .eq(
      "tipo_reporte",
      "Ventas por artículo"
    )
    .eq(
      "estado",
      "procesado"
    )
    .not(
      "branch_id",
      "is",
      null
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `No se pudieron consultar las ventas por sucursal: ${error.message}`
    );
  }

  const resultado = [];

  const sucursalesProcesadas =
    new Set();

  for (
    const importacion of
    importaciones || []
  ) {
    if (
      !importacion.branch_id ||
      sucursalesProcesadas.has(
        importacion.branch_id
      )
    ) {
      continue;
    }

    sucursalesProcesadas.add(
      importacion.branch_id
    );

    const [
      ventas,
      detalles,
    ] = await Promise.all([
      obtenerVentasArticulosPorImportacion(
        importacion.id
      ),

      obtenerDetallesPaginados(
        importacion.id,
        `No se pudieron consultar los detalles de ventas ${importacion.branch_id}`
      ),
    ]);

    const periodo =
      obtenerPeriodoDesdeDetalles(
        detalles
      ) ||
      obtenerPeriodoDesdeVentas(
        ventas
      );

    resultado.push({
      importacion,

      branch_id:
        importacion.branch_id,

      ventas,

      periodo,
    });
  }

  return resultado;
}