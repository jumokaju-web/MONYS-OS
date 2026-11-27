import { generarCompraMaestra } from "../../inventario/services/compraMaestraService";
import { obtenerDeudasFinancieras } from "../../inteligencia/services/deudasFinancierasService";
import { construirAccionesDelDia } from "../../../core/impacto/accionesDelDia.js";

/*
 * Carga traspasos y compras (Compra Maestra ya incluye el plan de
 * traspasos) y deudas abiertas. Si una fuente falla, las demás siguen y
 * el error se informa sin convertirlo en "no hay acciones".
 */
export async function obtenerAccionesDelDia({ organizationId = null, businessId = null } = {}) {
  const [compra, deudas] = await Promise.allSettled([
    generarCompraMaestra(businessId),
    organizationId
      ? obtenerDeudasFinancieras({ organizationId, businessId })
      : Promise.resolve([]),
  ]);

  const errores = [];
  if (compra.status === "rejected") {
    errores.push(`Compras y traspasos: ${compra.reason?.message || "no disponible"}`);
  }
  if (deudas.status === "rejected") {
    errores.push(`Deudas: ${deudas.reason?.message || "no disponible"}`);
  }

  const compraMaestra = compra.status === "fulfilled" ? compra.value : null;
  const listaDeudas = deudas.status === "fulfilled" && Array.isArray(deudas.value) ? deudas.value : [];

  return {
    ...construirAccionesDelDia({
      traspasos: compraMaestra?.planTraspasos || [],
      productosCompra: compraMaestra?.productos || [],
      deudas: listaDeudas,
    }),
    errores,
  };
}
