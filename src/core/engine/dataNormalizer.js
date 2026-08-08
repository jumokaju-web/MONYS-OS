/**
 * Convierte los datos leídos de SICAR a un formato interno uniforme.
 */
export function normalizarDatos(datos = []) {
  if (!Array.isArray(datos) || datos.length === 0) {
    return {
      exito: false,
      datos: [],
      mensaje: "No hay datos para normalizar.",
    };
  }

  const encabezados = datos[0];
  const registros = datos.slice(1);

  const resultado = registros.map((fila) => {
    const objeto = {};

    encabezados.forEach((encabezado, indice) => {
      objeto[String(encabezado).trim()] = fila[indice] ?? "";
    });

    return objeto;
  });

  return {
    exito: true,
    totalRegistros: resultado.length,
    datos: resultado,
  };
}