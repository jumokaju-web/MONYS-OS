export function crearPendienteExistenciaDestino(datos) {
  return {
    ...datos,
    existenciaDestino: null,
    cantidadSugerida: null,
    prioridad: "PENDIENTE",
    estado: "PENDIENTE_EXISTENCIA_DESTINO",
  };
}
