export function validarPeriodosSuperpuestos(archivos = []) {
  const rangos = archivos
    .map((archivo) => {
      const filaConPeriodo = (archivo.datosNormalizados || []).find(
        (fila) => fila?.periodoInicio && fila?.periodoFin
      );
      if (!filaConPeriodo) return null;
      return {
        nombre: archivo.nombre || archivo.name || "Reporte",
        tipo: archivo.tipoReporte || "",
        inicio: filaConPeriodo.periodoInicio,
        fin: filaConPeriodo.periodoFin,
      };
    })
    .filter(Boolean);

  for (let i = 0; i < rangos.length; i += 1) {
    for (let j = i + 1; j < rangos.length; j += 1) {
      const a = rangos[i];
      const b = rangos[j];
      if (
        a.tipo &&
        a.tipo === b.tipo &&
        a.inicio <= b.fin &&
        b.inicio <= a.fin
      ) {
        return `Los reportes “${a.nombre}” y “${b.nombre}” son de ${a.tipo} y sus periodos se traslapan. Importa un corte por vez: MONYS conserva el historial y usa el último corte procesado en el tablero, no suma ambos.`;
      }
    }
  }

  return null;
}
