import { supabase } from "../../../supabase";

export async function obtenerCortesCajaSicar({ branchIds = [], limiteImportaciones = 20 } = {}) {
  const ids = [...new Set((branchIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const { data: importaciones, error: errorImportaciones } = await supabase
    .from("importaciones")
    .select("id, branch_id, archivo_original, created_at, total_filas")
    .eq("estado", "procesado")
    .eq("tipo_reporte", "Cortes de caja")
    .in("branch_id", ids)
    .order("created_at", { ascending: false })
    .limit(limiteImportaciones);
  if (errorImportaciones) {
    throw new Error(`No se pudieron consultar los cortes oficiales: ${errorImportaciones.message}`);
  }
  if (!importaciones?.length) return [];

  // La pantalla operativa usa la carga vigente de cada sucursal. Las anteriores
  // permanecen en Historial para auditoría, pero no se vuelven a sumar.
  const sucursalesIncluidas = new Set();
  const importacionesVigentes = importaciones.filter((importacion) => {
    if (sucursalesIncluidas.has(importacion.branch_id)) return false;
    sucursalesIncluidas.add(importacion.branch_id);
    return true;
  });

  const { data: detalles, error: errorDetalles } = await supabase
    .from("importacion_detalle")
    .select("id, importacion_id, numero_fila, datos_originales")
    .in("importacion_id", importacionesVigentes.map((item) => item.id))
    .order("numero_fila", { ascending: true });
  if (errorDetalles) {
    throw new Error(`No se pudo leer el detalle de los cortes: ${errorDetalles.message}`);
  }

  const detallesPorImportacion = new Map();
  for (const detalle of detalles || []) {
    const grupo = detallesPorImportacion.get(detalle.importacion_id) || [];
    grupo.push(detalle);
    detallesPorImportacion.set(detalle.importacion_id, grupo);
  }

  return importacionesVigentes.map((importacion) => ({
    ...importacion,
    cortes: (detallesPorImportacion.get(importacion.id) || []).map((detalle) => ({
      ...detalle.datos_originales,
      importacionDetalleId: detalle.id,
      numeroFila: detalle.numero_fila,
    })),
  }));
}
