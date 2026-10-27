import { consolidarFinanzasSucursales } from "../../inteligencia/shared/resumenSucursalesFinanciero.js";

export function resumirCorteFinancieroDireccion(sucursales = []) {
  const consolidacion = consolidarFinanzasSucursales(sucursales);
  if (!consolidacion.disponible) {
    return {
      disponible: false,
      ventas: null,
      utilidad: null,
      costo: null,
      margen: null,
      fechaInicial: null,
      fechaFinal: null,
      motivo: consolidacion.motivo || "No hay un corte comparable confirmado.",
    };
  }

  return {
    ...consolidacion,
    disponible: true,
    motivo: null,
  };
}
