/**
 * Lee un archivo Excel de SICAR y devuelve la primera hoja en formato JSON.
 */
export async function leerExcel(file) {
  try {
    const limiteBytes = 10 * 1024 * 1024;
    if (!file || typeof file.arrayBuffer !== "function") throw new Error("Selecciona un archivo Excel o CSV válido.");
    if (Number(file.size) > limiteBytes) throw new Error("El archivo supera el límite de 10 MB. Divide el reporte antes de importarlo.");
    if (file.name && !/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Solo se aceptan archivos .xlsx, .xls o .csv.");
    const buffer = await file.arrayBuffer();
    if (!buffer?.byteLength) throw new Error("El archivo está vacío.");
    if (buffer.byteLength > limiteBytes) throw new Error("El archivo supera el límite de 10 MB. Divide el reporte antes de importarlo.");
    // Excel se descarga solo cuando la persona importa un archivo; no al abrir MONYS.
    const XLSX = await import("xlsx");

    const esCsv = /\.csv$/i.test(file.name || "") || file.type === "text/csv";
    if (/\.xls$/i.test(file.name || "")) {
      XLSX.set_cptable(await import("xlsx/dist/cpexcel.full.mjs"));
    }
    let entrada = buffer;
    if (esCsv) {
      const bytes = new Uint8Array(buffer);
      if (bytes[0] === 0xff && bytes[1] === 0xfe) entrada = new TextDecoder("utf-16le", { fatal: true }).decode(buffer);
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) entrada = new TextDecoder("utf-16be", { fatal: true }).decode(buffer);
      else {
        try { entrada = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
        catch { entrada = new TextDecoder("windows-1252", { fatal: true }).decode(buffer); }
      }
    }
    const workbook = XLSX.read(entrada, esCsv
      ? { type: "string", raw: true }
      : { type: "array" });

    const nombreHoja = workbook.SheetNames[0];

    const hoja = workbook.Sheets[nombreHoja];
    if (!hoja) throw new Error("El archivo no contiene una hoja de datos válida.");

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
