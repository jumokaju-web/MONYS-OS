function normalizarTexto(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sucursalConocida(valor = "") {
  const texto = normalizarTexto(valor);
  if (texto.includes("general") || texto.includes("anaya")) return "general anaya";
  if (texto.includes("centro")) return "centro";
  return null;
}

function nombreSucursal(sucursal) {
  return sucursal === "centro" ? "Centro" : "General Anaya";
}

function sucursalesDeFilas(archivo = {}) {
  const filas = Array.isArray(archivo.datosNormalizados)
    ? archivo.datosNormalizados
    : [];
  return new Set(
    filas
      .flatMap((fila) => [fila?.sucursal, fila?.usuario, fila?.vendedor])
      .map(sucursalConocida)
      .filter(Boolean)
  );
}

export function validarSucursalImportacion(archivos = [], sucursalSeleccionada) {
  if (!sucursalSeleccionada?.id) {
    return "Selecciona la sucursal del reporte antes de importar.";
  }

  const sucursalElegida = sucursalConocida(sucursalSeleccionada.name);
  const sucursalesDetectadas = new Set();

  for (const archivo of archivos) {
    const nombre = archivo.nombre || archivo.name || "El reporte";
    const sucursalNombre = sucursalConocida(nombre);
    const sucursalesFilas = sucursalesDeFilas(archivo);

    if (sucursalesFilas.size > 1) {
      return `El reporte “${nombre}” mezcla registros de Centro y General Anaya. Sepáralo antes de importar.`;
    }

    const sucursalContenido = [...sucursalesFilas][0];
    if (sucursalNombre && sucursalContenido && sucursalNombre !== sucursalContenido) {
      return `El nombre de “${nombre}” indica ${nombreSucursal(sucursalNombre)}, pero sus filas SICAR indican ${nombreSucursal(sucursalContenido)}. Verifica el archivo antes de importarlo.`;
    }

    if (sucursalNombre) sucursalesDetectadas.add(sucursalNombre);
    if (sucursalContenido) sucursalesDetectadas.add(sucursalContenido);
  }

  if (sucursalesDetectadas.size > 1) {
    return "La cola mezcla archivos de Centro y General Anaya. Importa una sucursal por carga.";
  }

  const sucursalDelArchivo = [...sucursalesDetectadas][0];
  if (sucursalDelArchivo && sucursalElegida && sucursalDelArchivo !== sucursalElegida) {
    return `El archivo parece ser de ${nombreSucursal(sucursalDelArchivo)}, pero está seleccionada ${nombreSucursal(sucursalElegida)}. Corrige la sucursal antes de importar.`;
  }

  return null;
}
