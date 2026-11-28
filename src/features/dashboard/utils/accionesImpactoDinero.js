import {
  ESTADOS_IMPACTO,
  priorizarAcciones,
  resumirImpacto,
} from "../../../core/impacto/motorImpactoDinero.js";

/*
 * Convierte recomendaciones de traspaso (rebalanceoInventarioService)
 * en acciones con impacto en dinero, ordenadas por lo que más conviene.
 */
export function construirAccionesTraspaso(recomendaciones = []) {
  return (recomendaciones || [])
    .filter((recomendacion) => recomendacion?.impactoDinero)
    .map((recomendacion) => ({
      id: `traspaso:${recomendacion.codigo || recomendacion.productId}:${recomendacion.branchOrigenId}:${recomendacion.branchDestinoId}`,
      tipo: "traspaso",
      titulo: `Traspasar ${recomendacion.cantidadSugerida} ${recomendacion.producto || "piezas"}`,
      detalle: `${recomendacion.sucursalOrigen || "Origen"} → ${recomendacion.sucursalDestino || "Destino"}`,
      // La misma mercancía de un origen hacia varios destinos son opciones
      // excluyentes: el resumen solo suma la mejor.
      grupoExclusivo: `traspaso:${recomendacion.codigo || recomendacion.productId}:${recomendacion.branchOrigenId}`,
      impacto: recomendacion.impactoDinero,
    }));
}

export function prepararImpactoDineroHoy({ recomendacionesTraspaso = [], limite = 5 } = {}) {
  const acciones = priorizarAcciones(construirAccionesTraspaso(recomendacionesTraspaso));
  const convienen = acciones.filter(
    (accion) => accion.impacto.estado !== ESTADOS_IMPACTO.NO_CONVIENE
  );
  return {
    resumen: resumirImpacto(acciones),
    principales: convienen.slice(0, limite),
    totalAcciones: convienen.length,
  };
}
