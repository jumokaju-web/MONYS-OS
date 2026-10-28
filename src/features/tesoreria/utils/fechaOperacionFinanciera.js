const ZONA_NEGOCIO = "America/Mexico_City";

/**
 * Convierte timestamps a la fecha operativa de México para comparar SICAR,
 * caja y banco. Las fechas YYYY-MM-DD se conservan como fecha calendario.
 */
export function fechaOperacionFinanciera(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";

  const fechaCalendario = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fechaCalendario) {
    const [, anio, mes, dia] = fechaCalendario;
    const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
    return fecha.getUTCFullYear() === Number(anio)
      && fecha.getUTCMonth() + 1 === Number(mes)
      && fecha.getUTCDate() === Number(dia)
      ? texto
      : "";
  }

  const fecha = new Date(texto);
  if (!Number.isFinite(fecha.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const porTipo = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${porTipo.year}-${porTipo.month}-${porTipo.day}`;
}
