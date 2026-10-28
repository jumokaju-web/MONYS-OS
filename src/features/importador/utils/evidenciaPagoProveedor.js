const activo = (registro) => String(registro?.estado || "").toUpperCase() === "ACTIVA";

function resumirBanco(vinculo) {
  const movimiento = vinculo?.snapshot?.banco || {};
  return {
    conciliacionId: vinculo.id,
    fecha: movimiento.fecha_operacion || vinculo.fecha_banco || null,
    cuenta: movimiento.cuenta || vinculo.cuenta || null,
    monto: Number(vinculo.monto ?? movimiento.cargo ?? movimiento.abono) || 0,
    descripcion: movimiento.descripcion || movimiento.referencia_visible || "Sin concepto bancario",
    direccion: vinculo.direccion || null,
    revisionBancariaId: vinculo.revision_bancaria_id || null,
  };
}

/**
 * Reúne evidencia ya confirmada de SICAR, Tesorería y banco a través del ID
 * único del movimiento de caja. Nunca convierte candidatos en conciliaciones.
 */
export function resumirEvidenciaPagoProveedor({
  detalleId,
  conciliacionesSicar = [],
  conciliacionesBancarias = [],
  pagoProveedor = null,
} = {}) {
  const sicar = (Array.isArray(conciliacionesSicar) ? conciliacionesSicar : [])
    .filter((item) => activo(item) && item.importacion_detalle_id === detalleId);
  const idsCaja = [...new Set(sicar.map((item) => item.cash_movement_id).filter(Boolean))];
  const banco = (Array.isArray(conciliacionesBancarias) ? conciliacionesBancarias : [])
    .filter((item) => activo(item) && idsCaja.includes(item.cash_movement_id));
  const sicarActivo = sicar.length === 1 ? sicar[0] : null;
  const bancoUnico = banco.length === 1 ? banco[0] : null;

  let estado;
  if (sicar.length > 1) estado = "AMBIGUA_SICAR";
  else if (!sicarActivo) estado = "FALTA_TESORERIA";
  else if (banco.length > 1) estado = "AMBIGUA_BANCO";
  else if (!bancoUnico) estado = "FALTA_BANCO";
  else estado = "TRES_FUENTES_VINCULADAS";

  return {
    estado,
    conciliacionSicar: sicarActivo,
    cashMovementId: sicarActivo?.cash_movement_id || null,
    conciliacionesBancarias: banco,
    banco: bancoUnico ? resumirBanco(bancoUnico) : null,
    pagoProveedor: activo(pagoProveedor) ? {
      id: pagoProveedor.id,
      proveedor: pagoProveedor.proveedor_nombre_snapshot,
      tipoAplicacion: pagoProveedor.tipo_aplicacion,
      importe: Number(pagoProveedor.importe_pago) || 0,
    } : null,
  };
}
