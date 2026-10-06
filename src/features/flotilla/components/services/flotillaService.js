import { supabase } from "../../../../supabase";

const CAMPOS_UNIDAD = `
  id,
  placas,
  tipo_operacion,
  tipo_propiedad,
  propietarios,
  da_nombre,
  chofer_nombre,
  quien_saca_nombre,
  estado,
  aplica_admin_chory,
  observaciones
`;

export async function obtenerUnidadesFlotilla() {
  const { data, error } = await supabase
    .from("flotilla_unidades")
    .select(CAMPOS_UNIDAD)
    .order("placas", { ascending: true });

  if (error) {
    console.error("Error al obtener unidades de Flotilla:", error);
    throw new Error("No fue posible cargar las unidades de Flotilla.");
  }

  return Array.isArray(data) ? data : [];
}

export async function obtenerUnidadPorPlacas(
  placas
) {
  if (!placas) {
    throw new Error(
      "Faltan las placas de la unidad."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("flotilla_unidades")
    .select(CAMPOS_UNIDAD)
    .eq("placas", placas)
    .single();

  if (error) {
    console.error(
      "Error al obtener unidad de Flotilla:",
      error
    );

    throw new Error(
      "No fue posible cargar la unidad de Flotilla."
    );
  }

  return data;
}
export async function obtenerRutaDeUnidadEnFecha(
  unidadId,
  fecha
) {
  if (!unidadId || !fecha) {
    throw new Error(
      "Faltan la unidad o la fecha de la ruta."
    );
  }

  const { data, error } = await supabase
    .from("flotilla_rutas")
    .select(`
      id,
      unidad_id,
      fecha,
      codigo_ruta,
      tipo_ruta,
      chofer_nombre,
      estado,
      paquetes_total,
      paros_total,
      kilometros_ruta
    `)
    .eq("unidad_id", unidadId)
    .eq("fecha", fecha)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error al obtener ruta de Flotilla:",
      error
    );

    throw new Error(
      "No fue posible cargar la ruta de Flotilla."
    );
  }

  return data;
}
