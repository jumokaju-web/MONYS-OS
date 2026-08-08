import * as XLSX from "xlsx";

/**
 * Lee un archivo Excel de SICAR y devuelve la primera hoja en formato JSON.
 */
export async function leerExcel(file) {
  try {
    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
      type: "array",
    });

    const nombreHoja = workbook.SheetNames[0];

    const hoja = workbook.Sheets[nombreHoja];

    const datos = XLSX.utils.sheet_to_json(hoja, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    return {
      exito: true,
      nombreHoja,
      datos,
      workbook,
    };
  } catch (error) {
    return {
      exito: false,
      error: error.message,
    };
  }
}