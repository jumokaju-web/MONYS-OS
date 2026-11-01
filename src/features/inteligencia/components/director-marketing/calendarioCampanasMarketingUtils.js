const ZONA_MONYS = "America/Mexico_City";

export function claveFechaMexico(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_MONYS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

export function horaMexico(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return "Hora pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA_MONYS,
    hour: "numeric",
    minute: "2-digit",
  }).format(fecha);
}
