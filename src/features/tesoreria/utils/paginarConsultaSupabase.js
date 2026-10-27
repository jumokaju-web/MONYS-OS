export async function consultarTodasLasPaginas(consultarPagina, { pageSize = 1000 } = {}) {
  if (typeof consultarPagina !== "function") {
    throw new TypeError("Se requiere una función para consultar las páginas.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("El tamaño de página debe ser un entero positivo.");
  }

  const filas = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await consultarPagina(inicio, inicio + pageSize - 1);
    if (error) throw error;

    const pagina = Array.isArray(data) ? data : [];
    filas.push(...pagina);
    if (pagina.length < pageSize) return filas;

    inicio += pageSize;
  }
}
