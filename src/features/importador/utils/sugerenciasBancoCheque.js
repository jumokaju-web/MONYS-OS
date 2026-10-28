import { cruzarBancoCaja } from "../../tesoreria/utils/cruceBancoCaja.js";

/** Sugiere evidencia bancaria para un cheque solo después de vincularlo a Tesorería. */
export function sugerirBancoParaCheque({ banco = [], movimientoCaja, conciliaciones = [] } = {}) {
  if (!movimientoCaja?.id) return { estado: "REQUIERE_VINCULO_TESORERIA", candidatos: [] };

  const activas = conciliaciones.filter((item) => item?.estado === "ACTIVA");
  const existentes = activas.filter((item) => item.cash_movement_id === movimientoCaja.id);
  if (existentes.length) {
    return { estado: existentes.length === 1 ? "VINCULADO" : "AMBIGUO_VINCULADO", candidatos: [] };
  }

  const movimientoSalida = {
    ...movimientoCaja,
    tipo: "salida",
  };
  const coincidencias = cruzarBancoCaja(banco, [movimientoSalida], activas)
    .filter((fila) => !fila.conciliacion && fila.candidatos.some((item) => item.id === movimientoCaja.id))
    .map((fila) => fila.banco);

  return {
    estado: coincidencias.length === 1 ? "CANDIDATO_UNICO" : coincidencias.length > 1 ? "AMBIGUO" : "SIN_COINCIDENCIA",
    candidatos: coincidencias,
  };
}
