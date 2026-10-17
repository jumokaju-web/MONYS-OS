export function calcularUnidadesParaDias({
  unidadesVendidas,
  diasAnalizados,
  diasObjetivo,
}) {
  if (
    unidadesVendidas === null ||
    unidadesVendidas === undefined ||
    String(unidadesVendidas).trim() === ""
  ) {
    return null;
  }

  const unidades = Number(unidadesVendidas);
  const dias = Number(diasAnalizados);
  const objetivo = Number(diasObjetivo);

  if (
    !Number.isFinite(unidades) ||
    unidades < 0 ||
    !Number.isFinite(dias) ||
    dias <= 0 ||
    !Number.isFinite(objetivo) ||
    objetivo < 0
  ) {
    return null;
  }

  return Math.ceil((unidades * objetivo) / dias);
}
