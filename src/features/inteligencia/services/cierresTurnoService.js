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
    .select(`
      id,
      branch_id,
      responsable,
      turno,
      pendientes,
      incidencias,
      productos_solicitados,
      objeciones_clientes,
      aprendizajes,
      observaciones,
      fecha,
      created_at
    `)
    .single();


  if (error) {
    console.error(
      "Error al guardar cierre de turno:",
      error
    );

    throw error;
  }


  if (!data?.id) {
    throw new Error(
      "El cierre se guardó pero no fue posible obtener su id."
    );
  }


  return data;
}


export async function obtenerCierresTurno({
  branchId = null,
  limite = 10,
} = {}) {
  let consulta =
    supabase
      .from(
        "cierres_turno"
      )
      .select(`
        id,
        branch_id,
        responsable,
        turno,
        pendientes,
        incidencias,
        productos_solicitados,
        objeciones_clientes,
        aprendizajes,
        observaciones,
        fecha,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(
        limite
      );


  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  }


  const {
    data,
    error,
  } = await consulta;


  if (error) {
    console.error(
      "Error al obtener cierres de turno:",
      error
    );

    throw error;
  }


  return Array.isArray(data)
    ? data
    : [];
}


export async function analizarCierreTurnoIA(
  cierreId
) {
  if (!cierreId) {
    throw new Error(
      "Falta el id del cierre."
    );
  }


  const {
    data,
    error,
  } = await supabase
    .functions
    .invoke(
      "analizar-cierre-turno",
      {
        body: {
          cierreId,
        },
      }
    );


  if (error) {
    console.error(
      "Error al ejecutar análisis del cierre:",
      error
    );

    throw error;
  }


  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "MONYS no pudo analizar el cierre."
    );
  }


  return data;
}


export async function analizarPatronesCierresIA({
  branchId = null,
  dias = 7,
} = {}) {
  const diasNormalizados =
    Number(
      dias || 7
    );


  const {
    data,
    error,
  } = await supabase
    .functions
    .invoke(
      "analizar-patrones-cierres",
      {
        body: {
          branchId,
          dias:
            diasNormalizados,
        },
      }
    );


  if (error) {
    console.error(
      "Error al ejecutar análisis de patrones de cierres:",
      error
    );

    throw error;
  }


  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "MONYS no pudo analizar los patrones de cierres."
    );
  }


  return data;
}