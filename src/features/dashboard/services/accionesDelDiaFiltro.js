/*
 * Verifica que lo que regresó cada fuente pertenezca al negocio activo.
 * Supabase ya filtra por RLS y por business_id; esta comprobación evita
 * que un error de filtro mezcle datos entre negocios en pantalla.
 * Devuelve solo lo válido y cuántos registros se descartaron.
 */
export function filtrarPorContexto({ organizationId, businessId, compraMaestra, deudas }) {
  const sucursalesNegocio = new Set(
    (compraMaestra?.fuentes || []).map((fuente) => String(fuente?.branchId)).filter(Boolean)
  );
  const enNegocio = (branchId) => sucursalesNegocio.has(String(branchId));

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
      String(deuda?.organization_id) === String(organizationId) &&
      String(deuda?.business_id) === String(businessId)
  );

  return {
    traspasos,
    productos,
    deudas: deudasValidas,
    descartados:
      (compraMaestra?.planTraspasos || []).length - traspasos.length +
      ((compraMaestra?.productos || []).length - productos.length) +
      ((deudas || []).length - deudasValidas.length),
  };
}
