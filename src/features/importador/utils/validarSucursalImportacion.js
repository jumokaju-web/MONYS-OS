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

export function validarSucursalImportacion(archivos = [], sucursalSeleccionada) {
  if (!sucursalSeleccionada?.id) {
    return "Selecciona la sucursal del reporte antes de importar.";
  }

  const sucursalElegida = sucursalConocida(sucursalSeleccionada.name);
  const sucursalesDetectadas = new Set(
    archivos
      .map((archivo) => sucursalConocida(archivo.nombre || archivo.name))
      .filter(Boolean)
  );

  if (sucursalesDetectadas.size > 1) {
    return "La cola mezcla archivos de Centro y General Anaya. Importa una sucursal por carga.";
  }

  const sucursalDelArchivo = [...sucursalesDetectadas][0];
  if (sucursalDelArchivo && sucursalElegida && sucursalDelArchivo !== sucursalElegida) {
    const nombreEsperado = sucursalDelArchivo === "centro" ? "Centro" : "General Anaya";
    const nombreElegido = sucursalElegida === "centro" ? "Centro" : "General Anaya";
    return `El archivo parece ser de ${nombreEsperado}, pero está seleccionada ${nombreElegido}. Corrige la sucursal antes de importar.`;
  }

  return null;
}
