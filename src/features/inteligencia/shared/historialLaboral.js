export function agruparHistorialLaboral(movimientos = []) {
  return (Array.isArray(movimientos) ? movimientos : []).reduce((grupos, movimiento) => {
    if (!movimiento?.empleado_id) return grupos;
    if (!grupos[movimiento.empleado_id]) grupos[movimiento.empleado_id] = [];
    grupos[movimiento.empleado_id].push(movimiento);
    return grupos;
  }, {});
}
