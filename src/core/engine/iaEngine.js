import { leerExcel } from "./excelReader";
import { detectarReporte } from "./reportDetector";

export async function ejecutarIA({
  file = null,
  contexto = {},
} = {}) {
  try {
    if (!file) {
      return {
        exito: false,
        errores: ["No se recibió ningún archivo."],
      };
    }

    // Leer Excel
    const resultadoExcel = await leerExcel(file);

    if (!resultadoExcel.exito) {
      return {
        exito: false,
        errores: [resultadoExcel.error],
      };
    }

    // Detectar tipo de reporte
   const resultadoDetector = detectarReporte(
  resultadoExcel.datos,
  resultadoExcel.nombreHoja
);

    if (!resultadoDetector.exito) {
      return {
        exito: false,
        errores: [resultadoDetector.mensaje],
      };
    }

    return {
      exito: true,
      fechaEjecucion: new Date().toISOString(),

      reporteProcesado: resultadoDetector.tipoReporte,

      configuracionReporte: resultadoDetector.configuracion,

      datosExcel: resultadoExcel.datos,

      contexto,

      directoresEjecutados: [],

      indicadoresActualizados: [],

      recomendaciones: [],

      errores: [],
    };
  } catch (error) {
    return {
      exito: false,
      errores: [error.message],
    };
  }
}