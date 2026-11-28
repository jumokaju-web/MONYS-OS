/*
 * Verifica que lo que regresó cada fuente pertenezca al negocio activo.
 *
 * Las sucursales autorizadas vienen de una consulta INDEPENDIENTE de
 * branches (business_id = negocio activo, activas), no de la respuesta de
 * Compra Maestra que se está verificando. Supabase ya filtra por RLS y por
 * business_id; esto evita que un error de filtro mezcle negocios.
 *
 * - Sucursal autorizada = id presente y business_id igual al activo.
 * - Identificadores ausentes (null, "", undefined) se rechazan.
 * - Devuelve solo lo válido y cuántos registros se descartaron.
 */
function idPresente(valor) {
  return valor !== null && valor !== undefined && String(valor).trim() !== "";
}

export function sucursalesAutorizadas(sucursales = [], businessId) {
  if (!idPresente(businessId)) return new Set();
  return new Set(
    (sucursales || [])
      .filter(
        (sucursal) =>
          idPresente(sucursal?.id) &&
          String(sucursal?.business_id) === String(businessId) &&
          sucursal?.active !== false
      )
      .map((sucursal) => String(sucursal.id))
  );
}

export function filtrarPorContexto({
  organizationId,
  businessId,
  sucursales = [],
  compraMaestra,
  deudas,
}) {
  const autorizadas = sucursalesAutorizadas(sucursales, businessId);
  const enNegocio = (branchId) => idPresente(branchId) && autorizadas.has(String(branchId));

  const traspasos = (compraMaestra?.planTraspasos || []).filter(
    (traspaso) => enNegocio(traspaso?.branchOrigenId) && enNegocio(traspaso?.branchDestinoId)
  );
  const productos = (compraMaestra?.productos || []).filter(
    (producto) =>
      Array.isArray(producto?.sucursales) &&
      producto.sucursales.length > 0 &&
      producto.sucursales.every((sucursal) => enNegocio(sucursal?.branchId))
  );
  const deudasValidas = (deudas || []).filter(
    (deuda) =>
      idPresente(organizationId) &&
      idPresente(businessId) &&
      String(deuda?.organization_id) === String(organizationId) &&
      String(deuda?.business_id) === String(businessId)
  );

  return {
    traspasos,
    productos,
    deudas: deudasValidas,
    sucursalesAutorizadas: autorizadas.size,
    descartados:
      (compraMaestra?.planTraspasos || []).length - traspasos.length +
      ((compraMaestra?.productos || []).length - productos.length) +
      ((deudas || []).length - deudasValidas.length),
  };
}
