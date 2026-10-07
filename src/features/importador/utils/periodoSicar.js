function fechaIso(anio, mes, dia) {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) return null;
  return fecha.toISOString().slice(0, 10);
}

export function normalizarFechaSicar(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === "number" && valor > 10000) {
    const milisegundos = Math.round((valor - 25569) * 86400 * 1000);
    const fecha = new Date(milisegundos);
    return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
  }

  const texto = String(valor ?? "").trim();
  if (!texto) return null;

  const iso = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return fechaIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const mexicana = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mexicana) {
    const anio = Number(mexicana[3].length === 2 ? `20${mexicana[3]}` : mexicana[3]);
    return fechaIso(anio, Number(mexicana[2]), Number(mexicana[1]));
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
}

export function extraerPeriodoSicar(filasAntesEncabezados = []) {
  for (const fila of filasAntesEncabezados) {
    const indicePeriodo = fila.findIndex((valor) =>
      String(valor ?? "")
        .trim()
        .toLowerCase()
        .replace(":", "") === "periodo"
    );
    if (indicePeriodo < 0) continue;

    const fechas = fila
      .slice(indicePeriodo + 1)
      .map(normalizarFechaSicar)
      .filter(Boolean);

    if (fechas.length >= 2 && fechas[0] <= fechas[1]) {
      return { periodoInicio: fechas[0], periodoFin: fechas[1] };
    }
  }

  return { periodoInicio: null, periodoFin: null };
}
