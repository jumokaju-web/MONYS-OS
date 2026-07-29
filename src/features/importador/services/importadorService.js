import { supabase } from "../../../supabase";

export async function guardarImportacion({
  tipoReporte,
  archivoOriginal,
  datosNormalizados,
}) {
  const { data: importacion, error: errorImportacion } = await supabase
    .from("importaciones")
    .insert({
      tipo_reporte: tipoReporte,
      archivo_original: archivoOriginal,
      estado: "procesado",
      total_filas: datosNormalizados.length,
    })
    .select()
    .single();

  if (errorImportacion) {
    throw new Error(
      `No se pudo crear la importación: ${errorImportacion.message}`
    );
  }

  const detalles = datosNormalizados.map((fila, indice) => ({
    importacion_id: importacion.id,
    numero_fila: indice + 1,
    codigo: fila.codigo,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    cantidad: fila.cantidad,
    datos_originales: fila,
  }));

  console.log(detalles[0]);
  
  const { error: errorDetalles } = await supabase
    .from("importacion_detalle")
    .insert(detalles);

  if (errorDetalles) {
    throw new Error(
      `No se pudieron guardar los detalles: ${errorDetalles.message}`
    );
  }

  return importacion;
}