import { supabase } from "../../../supabase";

export async function obtenerUltimaImportacionVentas() {
  const { data: importacion, error: errorImportacion } =
    await supabase
      .from("importaciones")
      .select("id, tipo_reporte, archivo_original, total_filas, created_at")
      .eq("tipo_reporte", "Ventas por artículo")
      .eq("estado", "procesado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (errorImportacion) {
    throw new Error(
      `No se pudo consultar la última importación: ${errorImportacion.message}`
    );
  }

  if (!importacion) {
    return null;
  }

  const { data: detalles, error: errorDetalles } =
    await supabase
      .from("importacion_detalle")
      .select(
        "id, numero_fila, codigo, descripcion, categoria, cantidad, datos_originales"
      )
      .eq("importacion_id", importacion.id)
      .order("numero_fila", { ascending: true });

  if (errorDetalles) {
    throw new Error(
      `No se pudieron consultar los detalles importados: ${errorDetalles.message}`
    );
  }

  return {
    importacion,
    detalles: detalles || [],
  };
}