/**
 * Conserva la identidad contable del movimiento al llevarlo a la bandeja.
 * La referencia original (por ejemplo, "admin") no se debe interpretar como
 * beneficiario; sí debe estar disponible para agrupar y revisar con auditoría.
 */
export function adaptarIdentidadMovimientoTesoreria(registro = {}) {
  return {
    organization_id: registro.organization_id || null,
    business_id: registro.business_id || null,
    branch_id: registro.branch_id || null,
    account_id: registro.account_id || null,
    account_name: registro.cuenta?.name || registro.account?.name || "",
    counterparty: registro.counterparty || "",
  };
}
