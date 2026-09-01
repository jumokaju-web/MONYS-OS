import { supabase } from "../../../supabase";

import {
  asignarResponsableAutomatico,
  obtenerEmpleadosActivosParaAsignacion,
} from "./empleadosRHService";


// ======================================================
// OBTENER TAREAS
// ======================================================

export async function obtenerTareasOperativas({
  branchId = null,
  fecha = null,
} = {}) {
  let consulta = supabase
    .from("tareas_operativas")
    .select(`
      id,
      organization_id,
      business_id,
      branch_id,
      titulo,
      descripcion,
      area,
      responsable,
      prioridad,
      estado,
      fecha,
      hora_limite,
      instrucciones,
      resultado,
      creada_por,
      completada_por,
      completada_at,
      requiere_evidencia,
      criterio_exito,
      calificacion_final,
      evaluacion_estado,
      evaluacion_resumen,
      requiere_revision,
      created_at,
      updated_at
    `)
    .order("prioridad", {
      ascending: false,
    })
    .order("created_at", {
      ascending: true,
    });

  if (branchId) {
    consulta = consulta.eq(
      "branch_id",
      branchId
    );
  }

  if (fecha) {
    consulta = consulta.eq(
      "fecha",
      fecha
    );
  }

  const {
    data,
    error,
  } = await consulta;

  if (error) {
    console.error(
      "Error al obtener tareas operativas:",
      error
    );

    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}


// ======================================================
// CREAR TAREA
// ======================================================

export async function crearTareaOperativa({
  organizationId = null,
  businessId = null,
  branchId = null,
  titulo,
  descripcion = null,
  area = "general",
  responsable = null,
  prioridad = "normal",
  fecha = null,
  horaLimite = null,
  instrucciones = null,
  creadaPor = null,
  requiereEvidencia = false,
  criterioExito = null,
}) {
  if (!String(titulo || "").trim()) {
    throw new Error(
      "El título de la tarea es obligatorio."
    );
  }

  const nuevaTarea = {
    organization_id:
      organizationId || null,

    business_id:
      businessId || null,

    branch_id:
      branchId || null,

    titulo:
      String(titulo).trim(),

    descripcion:
      descripcion
        ? String(descripcion).trim()
        : null,

    area:
      area || "general",

    responsable:
      responsable || null,

    prioridad:
      prioridad || "normal",

    estado:
      "pendiente",

    fecha:
      fecha ||
      new Date()
        .toISOString()
        .slice(0, 10),

    hora_limite:
      horaLimite || null,

    instrucciones:
      instrucciones
        ? String(instrucciones).trim()
        : null,

    creada_por:
      creadaPor || null,

    requiere_evidencia:
      Boolean(
        requiereEvidencia
      ),

    criterio_exito:
      criterioExito
        ? String(
            criterioExito
          ).trim()
        : null,

    updated_at:
      new Date().toISOString(),
  };

  const {
    data,
    error,
  } = await supabase
    .from("tareas_operativas")
    .insert(
      nuevaTarea
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error al crear tarea operativa:",
      error
    );

    throw error;
  }

  return data;
}

export async function crearTareaCorreccionInventario({
  organizationId = null,
  businessId = null,
  branchId = null,

  codigo = "",
  producto = "Producto",

  existenciaSistema = null,
  existenciaFisica = null,

  responsable = null,
  prioridad = "alta",
  creadaPor = null,

  origen = "revision_inventario",
} = {}) {
  const codigoLimpio =
    String(codigo || "").trim();

  const productoLimpio =
    String(producto || "Producto").trim();

  const tieneExistenciaSistema =
    Number.isFinite(
      Number(existenciaSistema)
    );

  const tieneExistenciaFisica =
    Number.isFinite(
      Number(existenciaFisica)
    );

  const sistema =
    tieneExistenciaSistema
      ? Number(existenciaSistema)
      : null;

  const fisico =
    tieneExistenciaFisica
      ? Number(existenciaFisica)
      : null;

  const diferencia =
    sistema !== null &&
    fisico !== null
      ? fisico - sistema
      : null;

  const descripcionPartes = [
    codigoLimpio
      ? `Código: ${codigoLimpio}.`
      : null,

    sistema !== null
      ? `Existencia en sistema: ${sistema}.`
      : "Existencia en sistema pendiente de confirmar.",

    fisico !== null
      ? `Existencia física reportada: ${fisico}.`
      : "Existencia física pendiente de conteo.",

    diferencia !== null
      ? `Diferencia detectada: ${diferencia}.`
      : null,

    `Origen de la revisión: ${origen}.`,
  ].filter(Boolean);

  return crearTareaOperativa({
    organizationId,
    businessId,
    branchId,

    titulo:
      `Verificar inventario: ${productoLimpio}`,

    descripcion:
      descripcionPartes.join(" "),

    area:
      "inventario",

    responsable,

    prioridad,

    creadaPor,

    requiereEvidencia:
      true,

    instrucciones:
      [
        "1. Localiza físicamente el producto.",
        "2. Cuenta todas las piezas disponibles.",
        "3. Verifica que el código corresponda al producto.",
        "4. Reporta la existencia física real.",
        "5. Toma evidencia si existe diferencia.",
        "6. No ajustes SICAR sin autorización.",
      ].join("\n"),

    criterioExito:
      "Producto contado físicamente, existencia real registrada y diferencia documentada cuando aplique.",
  });
}

// ======================================================
// OBTENER CORRECCIONES DE INVENTARIO DISPONIBLES
// ======================================================

export async function obtenerCorreccionesInventarioDisponibles({
  branchId = null,
  fecha = null,
} = {}) {
  let consulta = supabase
    .from("tareas_operativas")
    .select(`
      id,
      organization_id,
      business_id,
      branch_id,
      titulo,
      descripcion,
      area,
      responsable,
      prioridad,
      estado,
      fecha,
      hora_limite,
      instrucciones,
      resultado,
      creada_por,
      completada_por,
      completada_at,
      requiere_evidencia,
      criterio_exito,
      calificacion_final,
      evaluacion_estado,
      evaluacion_resumen,
      requiere_revision,
      created_at,
      updated_at
    `)
    .eq(
      "area",
      "inventario"
    )
    .eq(
      "estado",
      "pendiente"
    )
    .is(
      "responsable",
      null
    )
    .order(
      "prioridad",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  }

  if (fecha) {
    consulta =
      consulta.eq(
        "fecha",
        fecha
      );
  }

  const {
    data,
    error,
  } = await consulta;

  if (error) {
    console.error(
      "Error al obtener correcciones de inventario disponibles:",
      error
    );

    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}


// ======================================================
// TOMAR CORRECCIÓN DE INVENTARIO
// ======================================================

export async function tomarCorreccionInventario({
  tareaId,
  responsable,
} = {}) {
  if (!tareaId) {
    throw new Error(
      "Falta el id de la tarea."
    );
  }

  const nombreResponsable =
    String(
      responsable || ""
    ).trim();

  if (!nombreResponsable) {
    throw new Error(
      "No se pudo identificar a la empleada."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("tareas_operativas")
    .update({
      responsable:
        nombreResponsable,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      tareaId
    )
    .eq(
      "estado",
      "pendiente"
    )
    .is(
      "responsable",
      null
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error(
      "Error al tomar corrección de inventario:",
      error
    );

    throw error;
  }

  if (!data) {
    throw new Error(
      "Esta corrección ya fue tomada por otra persona o ya no está disponible."
    );
  }

  return data;
}

// ======================================================
// CAMBIAR ESTADO
// ======================================================

export async function cambiarEstadoTareaOperativa({
  tareaId,
  estado,
  completadaPor = null,
  resultado = null,
}) {
  if (!tareaId) {
    throw new Error(
      "Falta el id de la tarea."
    );
  }

  const estadosValidos = [
    "pendiente",
    "en_proceso",
    "terminada",
    "cancelada",
  ];

  if (
    !estadosValidos.includes(
      estado
    )
  ) {
    throw new Error(
      "Estado de tarea no válido."
    );
  }

  const cambios = {
    estado,

    resultado:
      resultado || null,

    updated_at:
      new Date().toISOString(),
  };

  if (
    estado === "terminada"
  ) {
    cambios.completada_por =
      completadaPor || null;

    cambios.completada_at =
      new Date().toISOString();

    cambios.evaluacion_estado =
      "analizando";

    cambios.evaluacion_resumen =
      "MONYS está revisando la evidencia.";

    cambios.requiere_revision =
      false;
  } else {
    cambios.completada_por =
      null;

    cambios.completada_at =
      null;

    if (
      estado === "pendiente"
    ) {
      cambios.evaluacion_estado =
        "pendiente";

      cambios.evaluacion_resumen =
        null;

      cambios.calificacion_final =
        null;

      cambios.requiere_revision =
        false;
    }
  }

  const {
    data,
    error,
  } = await supabase
    .from("tareas_operativas")
    .update(
      cambios
    )
    .eq(
      "id",
      tareaId
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error al actualizar tarea operativa:",
      error
    );

    throw error;
  }

  return data;
}


// ======================================================
// ELIMINAR
// ======================================================

export async function eliminarTareaOperativa(
  tareaId
) {
  if (!tareaId) {
    throw new Error(
      "Falta el id de la tarea."
    );
  }

  const {
    error,
  } = await supabase
    .from("tareas_operativas")
    .delete()
    .eq(
      "id",
      tareaId
    );

  if (error) {
    console.error(
      "Error al eliminar tarea operativa:",
      error
    );

    throw error;
  }

  return true;
}


// ======================================================
// SUBIR EVIDENCIA
// ======================================================

export async function subirEvidenciaTarea({
  tareaId,
  tipo,
  archivo,
  responsable = null,
  descripcion = null,
}) {
  if (!tareaId) {
    throw new Error(
      "Falta el id de la tarea."
    );
  }

  if (!archivo) {
    throw new Error(
      "Selecciona una imagen."
    );
  }

  const tiposValidos = [
    "inicio",
    "final",
    "adicional",
  ];

  if (
    !tiposValidos.includes(
      tipo
    )
  ) {
    throw new Error(
      "Tipo de evidencia no válido."
    );
  }

  const extension =
    archivo.name
      ?.split(".")
      .pop()
      ?.toLowerCase() ||
    "jpg";

  const nombreArchivo =
    `${tareaId}/${tipo}-${Date.now()}.${extension}`;

  const {
    error: errorStorage,
  } = await supabase.storage
    .from("tareas-evidencias")
    .upload(
      nombreArchivo,
      archivo,
      {
        cacheControl:
          "3600",

        upsert:
          false,
      }
    );

  if (errorStorage) {
    console.error(
      "Error al subir evidencia:",
      errorStorage
    );

    throw errorStorage;
  }

  const {
    data: urlData,
  } = supabase.storage
    .from("tareas-evidencias")
    .getPublicUrl(
      nombreArchivo
    );

  const archivoUrl =
    urlData?.publicUrl ||
    null;

  const {
    data,
    error,
  } = await supabase
    .from("tarea_evidencias")
    .insert({
      tarea_id:
        tareaId,

      tipo,

      archivo_path:
        nombreArchivo,

      archivo_url:
        archivoUrl,

      descripcion:
        descripcion || null,

      responsable:
        responsable || null,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "Error al guardar evidencia:",
      error
    );

    throw error;
  }

  return data;
}


// ======================================================
// OBTENER EVIDENCIAS
// ======================================================

export async function obtenerEvidenciasTarea(
  tareaId
) {
  if (!tareaId) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from("tarea_evidencias")
    .select(`
      id,
      tarea_id,
      tipo,
      archivo_path,
      archivo_url,
      descripcion,
      responsable,
      created_at
    `)
    .eq(
      "tarea_id",
      tareaId
    )
    .order(
      "created_at",
      {
        ascending:
          true,
      }
    );

  if (error) {
    console.error(
      "Error al obtener evidencias:",
      error
    );

    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}


// ======================================================
// MARCAR PARA EVALUACIÓN
// ======================================================

export async function marcarTareaParaEvaluacion(
  tareaId
) {
  if (!tareaId) {
    throw new Error(
      "Falta el id de la tarea."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("tareas_operativas")
    .update({
      evaluacion_estado:
        "analizando",

      requiere_revision:
        false,

      evaluacion_resumen:
        "MONYS está revisando la evidencia.",

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      tareaId
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error al enviar tarea a evaluación:",
      error
    );

    throw error;
  }

  return data;
}


// ======================================================
// GUARDAR EVALUACIÓN
// ======================================================

export async function guardarEvaluacionTarea({
  tareaId,
  puntuacionTotal,
  limpieza = null,
  orden = null,
  cumplimiento = null,
  presentacion = null,
  confianzaIA = null,
  resultado,
  resumen,
  problemasDetectados = [],
  recomendaciones = [],
}) {
  if (!tareaId) {
    throw new Error(
      "Falta el id de la tarea."
    );
  }

  const resultadosValidos = [
    "aprobada",
    "aceptable",
    "corregir",
    "revision_humana",
  ];

  if (
    !resultadosValidos.includes(
      resultado
    )
  ) {
    throw new Error(
      "Resultado de evaluación no válido."
    );
  }

  const {
    data: evaluacion,
    error: errorEvaluacion,
  } = await supabase
    .from("tarea_evaluaciones")
    .insert({
      tarea_id:
        tareaId,

      puntuacion_total:
        puntuacionTotal,

      limpieza,

      orden,

      cumplimiento,

      presentacion,

      confianza_ia:
        confianzaIA,

      resultado,

      resumen:
        resumen || null,

      problemas_detectados:
        problemasDetectados,

      recomendaciones:
        recomendaciones,
    })
    .select()
    .single();

  if (errorEvaluacion) {
    console.error(
      "Error al guardar evaluación:",
      errorEvaluacion
    );

    throw errorEvaluacion;
  }

  let evaluacionEstado =
    "revision_humana";

  let requiereRevision =
    true;

  if (
    resultado ===
      "aprobada" ||
    resultado ===
      "aceptable"
  ) {
    evaluacionEstado =
      "aprobada";

    requiereRevision =
      false;
  }

  if (
    resultado ===
    "corregir"
  ) {
    evaluacionEstado =
      "corregir";

    requiereRevision =
      true;
  }

  const {
    data: tarea,
    error: errorTarea,
  } = await supabase
    .from("tareas_operativas")
    .update({
      calificacion_final:
        puntuacionTotal,

      evaluacion_estado:
        evaluacionEstado,

      evaluacion_resumen:
        resumen || null,

      requiere_revision:
        requiereRevision,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      tareaId
    )
    .select()
    .single();

  if (errorTarea) {
    console.error(
      "Error al actualizar resultado de tarea:",
      errorTarea
    );

    throw errorTarea;
  }

  return {
    evaluacion,
    tarea,
  };
}


// ======================================================
// EJECUTAR EVALUACIÓN IA
// ======================================================

export async function ejecutarEvaluacionTareaIA(
  tareaId
) {
  if (!tareaId) {
    throw new Error(
      "Falta el id de la tarea."
    );
  }

  const {
    data,
    error,
  } = await supabase.functions.invoke(
    "evaluar-tarea",
    {
      body: {
        tareaId,
      },
    }
  );

  if (error) {
    console.error(
      "Error al ejecutar evaluación IA:",
      error
    );

    throw error;
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "MONYS no pudo evaluar la tarea."
    );
  }

  return data;
}


// ======================================================
// AUTOMATIZACIÓN DESDE PATRONES
// ======================================================

function normalizarPrioridadAutomatica(
  prioridad
) {
  const valor =
    String(
      prioridad || ""
    )
      .trim()
      .toUpperCase();

  if (
    valor === "URGENTE" ||
    valor === "CRITICA" ||
    valor === "CRÍTICA"
  ) {
    return "critica";
  }

  if (
    valor === "ALTA"
  ) {
    return "alta";
  }

  if (
    valor === "MEDIA"
  ) {
    return "media";
  }

  return "normal";
}


function debeCrearTareaAutomatica(
  prioridad
) {
  const valor =
    normalizarPrioridadAutomatica(
      prioridad
    );

  return (
    valor ===
      "critica" ||
    valor ===
      "alta"
  );
}


// ======================================================
// NORMALIZAR TEXTO
// ======================================================

function normalizarTextoAutomatizacion(
  valor
) {
  return String(
    valor || ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9ñ\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


const PALABRAS_VACIAS =
  new Set([
    "a",
    "al",
    "algo",
    "como",
    "con",
    "de",
    "del",
    "el",
    "en",
    "entre",
    "es",
    "esta",
    "este",
    "la",
    "las",
    "lo",
    "los",
    "mejorar",
    "para",
    "por",
    "que",
    "se",
    "sin",
    "su",
    "sus",
    "un",
    "una",
    "y",
  ]);


function obtenerTokensRelevantes(
  texto
) {
  return normalizarTextoAutomatizacion(
    texto
  )
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4 &&
        !PALABRAS_VACIAS.has(
          token
        )
    );
}


// ======================================================
// SIMILITUD ENTRE DOS TAREAS
// ======================================================

function calcularSimilitudTextos(
  textoA,
  textoB
) {
  const tokensA =
    new Set(
      obtenerTokensRelevantes(
        textoA
      )
    );

  const tokensB =
    new Set(
      obtenerTokensRelevantes(
        textoB
      )
    );

  if (
    tokensA.size === 0 ||
    tokensB.size === 0
  ) {
    return 0;
  }

  let interseccion =
    0;

  tokensA.forEach(
    (token) => {
      if (
        tokensB.has(token)
      ) {
        interseccion +=
          1;
      }
    }
  );

  const union =
    new Set([
      ...tokensA,
      ...tokensB,
    ]).size;

  return union > 0
    ? interseccion /
        union
    : 0;
}


// ======================================================
// FAMILIAS DE PROBLEMAS
// ======================================================

function detectarFamiliaOperativa({
  titulo = "",
  descripcion = "",
} = {}) {
  const texto =
    normalizarTextoAutomatizacion(
      `${titulo} ${descripcion}`
    );

  const familias = [
    {
      id:
        "discrepancia_factura",

      palabras: [
        "factura",
        "discrepancia",
        "mercancia recibida",
        "no cuadra",
      ],
    },

    {
      id:
        "faltantes_stock",

      palabras: [
        "faltante",
        "faltantes",
        "stock",
        "reponer",
        "reposicion",
        "agotado",
        "probador",
        "probadores",
      ],
    },

    {
      id:
        "limpieza_orden",

      palabras: [
        "limpieza",
        "limpiar",
        "acomodar",
        "acomodo",
        "organizar",
        "orden",
      ],
    },

    {
      id:
        "registro_producto_nuevo",

      palabras: [
        "registro",
        "registrar",
        "producto nuevo",
        "productos nuevos",
        "disponibilidad",
      ],
    },

    {
      id:
        "precios_demanda",

      palabras: [
        "precio",
        "precios",
        "demanda",
        "aceptacion",
        "oferta",
      ],
    },
  ];

  let mejorFamilia =
    null;

  let mejorPuntaje =
    0;

  familias.forEach(
    (familia) => {
      const puntaje =
        familia.palabras.reduce(
          (
            total,
            palabra
          ) =>
            total +
            (
              texto.includes(
                palabra
              )
                ? 1
                : 0
            ),
          0
        );

      if (
        puntaje >
        mejorPuntaje
      ) {
        mejorPuntaje =
          puntaje;

        mejorFamilia =
          familia.id;
      }
    }
  );

  return mejorPuntaje > 0
    ? mejorFamilia
    : null;
}


// ======================================================
// TAREAS ACTIVAS DEL DÍA
// ======================================================

async function obtenerTareasActivasParaComparar({
  branchId = null,
  fecha,
}) {
  let consulta =
    supabase
      .from(
        "tareas_operativas"
      )
      .select(`
        id,
        branch_id,
        titulo,
        descripcion,
        responsable,
        prioridad,
        estado,
        fecha,
        creada_por,
        created_at
      `)
      .eq(
        "fecha",
        fecha
      )
      .in(
        "estado",
        [
          "pendiente",
          "en_proceso",
        ]
      );

  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  } else {
    consulta =
      consulta.is(
        "branch_id",
        null
      );
  }

  const {
    data,
    error,
  } = await consulta;

  if (error) {
    console.error(
      "Error al revisar tareas activas:",
      error
    );

    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}


// ======================================================
// BUSCAR DUPLICADO INTELIGENTE
// ======================================================

async function buscarTareaAutomaticaExistente({
  branchId = null,
  titulo,
  descripcion = "",
  fecha,
}) {
  const tareasActivas =
    await obtenerTareasActivasParaComparar({
      branchId,
      fecha,
    });

  const tituloNormalizado =
    normalizarTextoAutomatizacion(
      titulo
    );

  const familiaNueva =
    detectarFamiliaOperativa({
      titulo,
      descripcion,
    });

  for (
    const tarea
    of tareasActivas
  ) {
    const tituloExistente =
      normalizarTextoAutomatizacion(
        tarea.titulo
      );

    // Título exactamente igual
    if (
      tituloNormalizado &&
      tituloExistente ===
        tituloNormalizado
    ) {
      return tarea;
    }

    const similitudTitulo =
      calcularSimilitudTextos(
        titulo,
        tarea.titulo
      );

    const similitudCompleta =
      calcularSimilitudTextos(
        `${titulo} ${descripcion}`,
        `${tarea.titulo} ${
          tarea.descripcion ||
          ""
        }`
      );

    const familiaExistente =
      detectarFamiliaOperativa({
        titulo:
          tarea.titulo,

        descripcion:
          tarea.descripcion ||
          "",
      });

    const mismaFamilia =
      Boolean(
        familiaNueva &&
        familiaExistente &&
        familiaNueva ===
          familiaExistente
      );

    // Misma tarea con redacción parecida
    if (
      similitudTitulo >=
        0.55 ||
      similitudCompleta >=
        0.62 ||
      (
        mismaFamilia &&
        Math.max(
          similitudTitulo,
          similitudCompleta
        ) >= 0.30
      )
    ) {
      return tarea;
    }
  }

  return null;
}


// ======================================================
// CARGA POR EMPLEADO
// ======================================================

async function obtenerCargaActivaPorResponsable({
  branchId,
  fecha,
}) {
  const tareas =
    await obtenerTareasActivasParaComparar({
      branchId,
      fecha,
    });

  const carga = {};

  tareas.forEach(
    (tarea) => {
      const clave =
        normalizarTextoAutomatizacion(
          tarea.responsable
        );

      if (!clave) {
        return;
      }

      carga[clave] =
        (
          carga[clave] ||
          0
        ) + 1;
    }
  );

  return carga;
}


// ======================================================
// EQUILIBRAR ASIGNACIÓN
// ======================================================

async function equilibrarAsignacion({
  branchId,
  fecha,
  asignacionPreferida,
}) {
  if (!branchId) {
    return (
      asignacionPreferida ||
      null
    );
  }

  const empleados =
    await obtenerEmpleadosActivosParaAsignacion(
      branchId
    );

  if (
    empleados.length === 0
  ) {
    return (
      asignacionPreferida ||
      null
    );
  }

  const carga =
    await obtenerCargaActivaPorResponsable({
      branchId,
      fecha,
    });

  const empleadosConCarga =
    empleados
      .map(
        (empleado) => ({
          empleado,

          carga:
            carga[
              normalizarTextoAutomatizacion(
                empleado.nombre
              )
            ] || 0,
        })
      )
      .sort(
        (a, b) =>
          a.carga -
          b.carga
      );

  const menorCarga =
    empleadosConCarga[0];

  if (!menorCarga) {
    return (
      asignacionPreferida ||
      null
    );
  }

  // Si no encontró perfil,
  // usa a quien tiene menos carga.
  if (
    !asignacionPreferida
      ?.nombre
  ) {
    return {
      empleadoId:
        menorCarga.empleado.id,

      usuarioId:
        menorCarga.empleado
          .usuario_id ||
        null,

      nombre:
        menorCarga.empleado
          .nombre,

      puesto:
        menorCarga.empleado
          .puesto ||
        null,

      cargaActual:
        menorCarga.carga,

      metodo:
        "MENOR_CARGA",
    };
  }

  const cargaPreferida =
    carga[
      normalizarTextoAutomatizacion(
        asignacionPreferida
          .nombre
      )
    ] || 0;

  /*
    REGLA DE REPARTO:

    Si la persona elegida por perfil
    ya tiene 2 o más tareas que la
    persona menos cargada,
    la siguiente se reparte.
  */

  if (
    cargaPreferida -
      menorCarga.carga >=
    2
  ) {
    return {
      empleadoId:
        menorCarga.empleado.id,

      usuarioId:
        menorCarga.empleado
          .usuario_id ||
        null,

      nombre:
        menorCarga.empleado
          .nombre,

      puesto:
        menorCarga.empleado
          .puesto ||
        null,

      cargaActual:
        menorCarga.carga,

      metodo:
        "BALANCE_CARGA",
    };
  }

  return asignacionPreferida;
}


// ======================================================
// DEDUPLICAR PRIORIDADES DEL MISMO ANÁLISIS
// ======================================================

function deduplicarPrioridadesEnMemoria(
  prioridades
) {
  const resultado = [];

  prioridades.forEach(
    (prioridad) => {
      const titulo =
        String(
          prioridad?.titulo ||
          ""
        ).trim();

      const descripcion =
        String(
          prioridad
            ?.descripcion ||
          ""
        ).trim();

      const familia =
        detectarFamiliaOperativa({
          titulo,
          descripcion,
        });

      const repetida =
        resultado.some(
          (existente) => {
            const familiaExistente =
              detectarFamiliaOperativa({
                titulo:
                  existente
                    ?.titulo ||
                  "",

                descripcion:
                  existente
                    ?.descripcion ||
                  "",
              });

            const similitud =
              calcularSimilitudTextos(
                `${titulo} ${descripcion}`,
                `${
                  existente
                    ?.titulo ||
                  ""
                } ${
                  existente
                    ?.descripcion ||
                  ""
                }`
              );

            if (
              similitud >=
              0.58
            ) {
              return true;
            }

            if (
              familia &&
              familiaExistente &&
              familia ===
                familiaExistente &&
              similitud >=
                0.28
            ) {
              return true;
            }

            return false;
          }
        );

      if (!repetida) {
        resultado.push(
          prioridad
        );
      }
    }
  );

  return resultado;
}


// ======================================================
// CREAR TAREA AUTOMÁTICA
// ======================================================

export async function crearTareaAutomaticaDesdePrioridad({
  prioridad,
  organizationId = null,
  businessId = null,
  branchId = null,
  creadaPor = "MONYS OS",
} = {}) {
  if (!prioridad) {
    return {
      creada:
        false,

      motivo:
        "SIN_PRIORIDAD",

      tarea:
        null,
    };
  }

  if (
    !debeCrearTareaAutomatica(
      prioridad.prioridad
    )
  ) {
    return {
      creada:
        false,

      motivo:
        "PRIORIDAD_NO_AUTOMATIZABLE",

      tarea:
        null,
    };
  }

  const titulo =
    String(
      prioridad.titulo ||
      ""
    ).trim();

  if (!titulo) {
    return {
      creada:
        false,

      motivo:
        "SIN_TITULO",

      tarea:
        null,
    };
  }

  const fecha =
    new Date()
      .toISOString()
      .slice(0, 10);

  const prioridadTarea =
    normalizarPrioridadAutomatica(
      prioridad.prioridad
    );

  const descripcionBase =
    prioridad.descripcion ||
    "MONYS detectó esta acción a partir de patrones repetidos en los cierres de turno.";

  const confianza =
    Number(
      prioridad.confianza ||
      0
    );

  const descripcion =
    confianza > 0
      ? `${descripcionBase} Confianza del análisis: ${Math.round(
          confianza
        )}%.`
      : descripcionBase;


  // --------------------------------------
  // PRIMERO: revisar duplicado
  // --------------------------------------

  const existente =
    await buscarTareaAutomaticaExistente({
      branchId,
      titulo,
      descripcion,
      fecha,
    });

  if (existente) {
    return {
      creada:
        false,

      motivo:
        "DUPLICADA",

      tarea:
        existente,
    };
  }


  // --------------------------------------
  // SEGUNDO: elegir por perfil
  // --------------------------------------

  let asignacionPreferida =
    null;

  try {
    asignacionPreferida =
      await asignarResponsableAutomatico({
        branchId,
        titulo,
        descripcion,
        area:
          "operacion",
        fecha,
      });
  } catch (
    errorAsignacion
  ) {
    console.error(
      "Error al calcular responsable preferido:",
      errorAsignacion
    );
  }


  // --------------------------------------
  // TERCERO: equilibrar carga
  // --------------------------------------

  let asignacion =
    asignacionPreferida;

  try {
    asignacion =
      await equilibrarAsignacion({
        branchId,
        fecha,
        asignacionPreferida,
      });
  } catch (
    errorBalance
  ) {
    console.error(
      "Error al equilibrar asignación:",
      errorBalance
    );
  }


  const responsableAutomatico =
    asignacion?.nombre ||
    prioridad.responsable ||
    "Operación";


  const instruccionesAutomaticas =
    asignacion?.nombre
      ? `Tarea asignada automáticamente por MONYS a ${asignacion.nombre}. Ejecutar la acción indicada y registrar evidencia del resultado.`
      : "Ejecutar la acción indicada por MONYS y registrar evidencia del resultado.";


  const tarea =
    await crearTareaOperativa({
      organizationId,
      businessId,
      branchId,

      titulo,

      descripcion,

      area:
        "operacion",

      responsable:
        responsableAutomatico,

      prioridad:
        prioridadTarea,

      fecha,

      instrucciones:
        instruccionesAutomaticas,

      creadaPor,

      requiereEvidencia:
        true,

      criterioExito:
        "La acción debe quedar resuelta y respaldada con evidencia suficiente para que MONYS pueda verificar el cumplimiento.",
    });


  return {
    creada:
      true,

    motivo:
      "CREADA",

    tarea,

    asignacion,
  };
}


// ======================================================
// CREAR TAREAS DESDE PATRONES
// ======================================================

export async function crearTareasAutomaticasDesdePatrones({
  prioridades = [],
  organizationId = null,
  businessId = null,
  branchId = null,
  creadaPor = "MONYS OS",
} = {}) {
  const lista =
    Array.isArray(
      prioridades
    )
      ? prioridades
      : [];


  // Solo patrones ALTA / CRÍTICA

  const prioridadesPatrones =
    lista.filter(
      (prioridad) => {
        const origen =
          String(
            prioridad?.origen ||
            ""
          )
            .trim()
            .toUpperCase();

        return (
          origen ===
            "PATRONES_CIERRES" &&
          debeCrearTareaAutomatica(
            prioridad
              ?.prioridad
          )
        );
      }
    );


  // --------------------------------------
  // QUITAR REPETIDOS DEL MISMO ANÁLISIS
  // --------------------------------------

  const prioridadesUnicas =
    deduplicarPrioridadesEnMemoria(
      prioridadesPatrones
    );


  // --------------------------------------
  // LÍMITE DE SEGURIDAD
  // Máximo 5 por cada análisis
  // --------------------------------------

  const prioridadesAProcesar =
    prioridadesUnicas.slice(
      0,
      5
    );


  const resultados = [];


  for (
    const prioridad
    of prioridadesAProcesar
  ) {
    try {
      const resultado =
        await crearTareaAutomaticaDesdePrioridad({
          prioridad,
          organizationId,
          businessId,
          branchId,
          creadaPor,
        });


      resultados.push({
        prioridadId:
          prioridad?.id ||
          null,

        titulo:
          prioridad?.titulo ||
          null,

        ...resultado,
      });
    } catch (error) {
      console.error(
        "Error al crear tarea automática desde patrón:",
        error
      );

      resultados.push({
        prioridadId:
          prioridad?.id ||
          null,

        titulo:
          prioridad?.titulo ||
          null,

        creada:
          false,

        motivo:
          "ERROR",

        tarea:
          null,

        error:
          error?.message ||
          "Error desconocido",
      });
    }
  }


  return {
    totalDetectadas:
      prioridadesPatrones.length,

    totalUnicas:
      prioridadesUnicas.length,

    totalRevisadas:
      prioridadesAProcesar.length,

    creadas:
      resultados.filter(
        (item) =>
          item.creada
      ).length,

    duplicadas:
      resultados.filter(
        (item) =>
          item.motivo ===
          "DUPLICADA"
      ).length,

    errores:
      resultados.filter(
        (item) =>
          item.motivo ===
          "ERROR"
      ).length,

    resultados,
  };
}