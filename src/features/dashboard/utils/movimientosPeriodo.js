const convertirFechaMovimiento = (valor) => {
  if (!valor) return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : new Date(valor);
  }

  const texto = String(valor).trim();
  const fechaSolo = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (fechaSolo) {
    const [, anio, mes, dia] = fechaSolo.map(Number);
    const fecha = new Date(anio, mes - 1, dia, 12);

    return fecha.getFullYear() === anio &&
      fecha.getMonth() === mes - 1 &&
      fecha.getDate() === dia
      ? fecha
      : null;
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export function obtenerFechaMovimiento(movimiento = {}) {
  const fechas = [
    movimiento.occurred_at,
    movimiento.fecha_iso,
    movimiento.fecha_movimiento,
    movimiento.movement_date,
    movimiento.created_at,
    movimiento.date,
    movimiento.fecha,
  ];

  for (const valor of fechas) {
    const fecha = convertirFechaMovimiento(valor);
    if (fecha) return fecha;
  }

  return null;
}
