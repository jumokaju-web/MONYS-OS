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

  if (!tiposValidos.includes(tipo)) {
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
        cacheControl: "3600",
        upsert: false,
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
      tarea_id: tareaId,
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
        ascending: true,
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