import { supabase } from "../../../supabase";


export async function guardarCierreTurno({
  branchId = null,
  responsable,
  turno = "cierre",
  pendientes = null,
  incidencias = null,
  productosSolicitados = null,
  objecionesClientes = null,
  aprendizajes = null,
  observaciones = null,
  fecha = null,
}) {
  if (
    !String(responsable || "")
      .trim()
  ) {
    throw new Error(
      "El responsable del cierre es obligatorio."
    );
  }


  const nuevoCierre = {
    branch_id:
      branchId || null,

    responsable:
      String(
        responsable
      ).trim(),

    turno:
      turno || "cierre",

    pendientes:
      pendientes
        ? String(
            pendientes
          ).trim()
        : null,

    incidencias:
      incidencias
        ? String(
            incidencias
          ).trim()
        : null,

    productos_solicitados:
      productosSolicitados
        ? String(
            productosSolicitados
          ).trim()
        : null,

    objeciones_clientes:
      objecionesClientes
        ? String(
            objecionesClientes
          ).trim()
        : null,

    aprendizajes:
      aprendizajes
        ? String(
            aprendizajes
          ).trim()
        : null,

    observaciones:
      observaciones
        ? String(
            observaciones
          ).trim()
        : null,

    fecha:
      fecha ||
      new Date()
        .toISOString()
        .slice(0, 10),
  };


  const {
    data,
    error,
  } = await supabase
    .from(
      "cierres_turno"
    )
    .insert(
      nuevoCierre
    )
    .select()
    .single();


  if (error) {
    console.error(
      "Error al guardar cierre de turno:",
      error
    );

    throw error;
  }


  return data;
}