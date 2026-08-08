import {
  detectarTipoReporteSicar,
  buscarConfiguracionReporte,
} from "../../config/sicarReportesConfig";

/**
 * Detecta automáticamente el tipo de reporte SICAR
 */
export function detectarReporte(datosExcel = [], nombreHoja = "") {
  try {
    const contenidoTexto = datosExcel
      .flat()
      .join(" ");

    const resultado =
      detectarTipoReporteSicar({
        nombreHoja,
        contenidoTexto,
      });

    if (
      !resultado ||
      resultado.tipo === "DESCONOCIDO"
    ) {
      return {
        exito: false,
        mensaje:
          "No se pudo identificar el reporte SICAR.",
      };
    }

    return {
      exito: true,
      tipoReporte: resultado.tipo,
      configuracion:
        buscarConfiguracionReporte(resultado.tipo),
      informacion: resultado,
    };
  } catch (error) {
    return {
      exito: false,
      mensaje: error.message,
    };
  }
}