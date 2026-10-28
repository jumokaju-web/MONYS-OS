export async function extraerTextoPdfBancario(archivo) {
  if (!archivo || typeof archivo.arrayBuffer !== "function") throw new Error("Selecciona un estado de cuenta PDF.");
  if (archivo.size > 25 * 1024 * 1024) throw new Error("El PDF supera 25 MB.");
  if (archivo.type && archivo.type !== "application/pdf" && !archivo.name?.toLowerCase().endsWith(".pdf")) {
    throw new Error("El archivo debe ser un PDF.");
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("El archivo no contiene una firma PDF válida.");

  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const documento = await pdfjs.getDocument({ data: bytes }).promise;
  if (documento.numPages < 1 || documento.numPages > 150) throw new Error("El PDF debe tener entre 1 y 150 páginas.");
  const lineas = [];
  for (let paginaNumero = 1; paginaNumero <= documento.numPages; paginaNumero += 1) {
    const pagina = await documento.getPage(paginaNumero);
    const contenido = await pagina.getTextContent();
    const elementos = contenido.items
      .filter((item) => typeof item.str === "string" && item.str.trim())
      .map((item) => ({ texto: item.str.trim(), x: item.transform?.[4] || 0, y: item.transform?.[5] || 0 }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const filas = [];
    for (const elemento of elementos) {
      let fila = filas.find((actual) => Math.abs(actual.y - elemento.y) <= 2.5);
      if (!fila) { fila = { y: elemento.y, elementos: [] }; filas.push(fila); }
      fila.elementos.push(elemento);
    }
    for (const fila of filas.sort((a, b) => b.y - a.y)) {
      const celdas = fila.elementos.sort((a, b) => a.x - b.x).map(({ texto, x }) => ({ texto, x }));
      const texto = celdas.map((item) => item.texto).join(" ").replace(/\s+/g, " ").trim();
      if (texto) lineas.push({ pagina: paginaNumero, y: fila.y, texto, celdas });
    }
  }
  const textoCompleto = lineas.map((linea) => linea.texto).join("\n");
  if (textoCompleto.trim().length < 80) throw new Error("El PDF no contiene texto seleccionable. No procesaré un escaneo sin OCR verificable.");
  const normalizado = textoCompleto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!normalizado.includes("BBVA")) throw new Error("El archivo no parece ser un estado de cuenta BBVA.");
  const encabezados = ["DESCRIPCION", "CARGOS", "ABONOS", "SALDO"].filter((titulo) => normalizado.includes(titulo));
  if (encabezados.length < 3) throw new Error("No reconozco con suficiente seguridad la tabla de movimientos de este estado BBVA.");
  return { paginas: documento.numPages, lineas, textoCompleto };
}
