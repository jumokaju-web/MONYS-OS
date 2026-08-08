import { supabase } from "../../../supabase";

async function obtenerDetallesPaginados(
  importacionId,
  mensajeError
) {
  const detalles = [];
  const tamanoLote = 1000;
  let inicio = 0;

  while (true) {
    const fin = inicio + tamanoLote - 1;

    const { data: lote, error } = await supabase
      .from("importacion_detalle")
      .select(
        "id, numero_fila, codigo, descripcion, categoria, cantidad, datos_originales"
      )
      .eq("importacion_id", importacionId)
      .order("numero_fila", {
        ascending: true,
      })
      .range(inicio, fin);

    if (error) {
      throw new Error(
        `${mensajeError}: ${error.message}`
      );
    }

    const filasRecibidas = lote || [];

    detalles.push(...filasRecibidas);

    if (filasRecibidas.length < tamanoLote) {
      break;
    }

    inicio += tamanoLote;
  }

  return detalles;
}

export async function obtenerVentasArticulosPorImportacion(
  importacionId
) {
  if (!importacionId) {
    return [];
  }

  const { data, error } = await supabase
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
    .eq("importacion_id", importacionId)
    .order("cantidad", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `No se pudieron consultar las ventas reales: ${error.message}`
    );
  }

  return data || [];
}

export async function obtenerUltimaImportacionVentas() {
  const { data: importacion, error } =
    await supabase
      .from("importaciones")
      .select(
        "id, tipo_reporte, archivo_original, total_filas, created_at"
      )
      .eq("tipo_reporte", "Ventas por artículo")
      .eq("estado", "procesado")
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

export async function obtenerUltimaImportacionUtilidadVentas() {
  const { data: importacion, error } =
    await supabase
      .from("importaciones")
      .select(
        "id, tipo_reporte, archivo_original, total_filas, created_at"
      )
      .eq("tipo_reporte", "Utilidad de ventas")
      .eq("estado", "procesado")
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

export async function obtenerUltimaImportacionInventario() {
  const { data: importacion, error } =
    await supabase
      .from("importaciones")
      .select(
        "id, tipo_reporte, archivo_original, total_filas, created_at"
      )
      .in("tipo_reporte", [
        "Inventario",
        "Inventario / Utilidad",
        "Existencias",
      ])
      .eq("estado", "procesado")
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