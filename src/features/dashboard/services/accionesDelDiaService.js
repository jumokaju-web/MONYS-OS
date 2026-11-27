import { generarCompraMaestra } from "../../inventario/services/compraMaestraService";
import { obtenerDeudasFinancieras } from "../../inteligencia/services/deudasFinancierasService";
import { construirAccionesDelDia } from "../../../core/impacto/accionesDelDia.js";
import { filtrarPorContexto } from "./accionesDelDiaFiltro.js";

export const ESTADOS_CONTEXTO = Object.freeze({
  LISTO: "listo",
  SIN_CONTEXTO: "sin_contexto",
});

/*
 * Carga traspasos y compras (Compra Maestra ya incluye el plan de
 * traspasos) y deudas abiertas del negocio activo.
 * - Sin organizationId o businessId no consulta nada y lo dice
 *   (estado "sin_contexto"); nunca lo presenta como "no hay acciones".
 * - Si una fuente falla, las demás siguen y el error se informa.
 */
export async function obtenerAccionesDelDia({ organizationId = null, businessId = null } = {}) {
  if (!organizationId || !businessId) {
    return {
      estado: ESTADOS_CONTEXTO.SIN_CONTEXTO,
      motivo: !organizationId
        ? "Falta identificar la organización activa."
        : "Falta identificar el negocio activo.",
      ...construirAccionesDelDia({}),
      errores: [],
    };
  }

  const [compra, deudas] = await Promise.allSettled([
    generarCompraMaestra(businessId),
    obtenerDeudasFinancieras({ organizationId, businessId }),
  ]);

  const errores = [];
  if (compra.status === "rejected") {
    errores.push(`Compras y traspasos: ${compra.reason?.message || "no disponible"}`);
  }
  if (deudas.status === "rejected") {
    errores.push(`Deudas: ${deudas.reason?.message || "no disponible"}`);
  }

  const filtrado = filtrarPorContexto({
    organizationId,
    businessId,
    compraMaestra: compra.status === "fulfilled" ? compra.value : null,
    deudas: deudas.status === "fulfilled" && Array.isArray(deudas.value) ? deudas.value : [],
  });
  if (filtrado.descartados > 0) {
    errores.push(`Se descartaron ${filtrado.descartados} registros que no pertenecen al negocio activo.`);
  }

  return {
    estado: ESTADOS_CONTEXTO.LISTO,
    motivo: "",
    ...construirAccionesDelDia({
      traspasos: filtrado.traspasos,
      productosCompra: filtrado.productos,
      deudas: filtrado.deudas,
    }),
    errores,
  };
}
