const texto = (valor) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Las sugerencias no cambian la categoría ni el estado contable guardado.
export function prepararRevisionFinanciera(movimientos = []) {
  return movimientos.flatMap((movimiento) => {
    if (texto(movimiento.estado ?? movimiento.status) === 'cancelado') return [];
    const concepto = movimiento.concepto ?? movimiento.concept ?? '';
    const categoria = movimiento.categoria ?? movimiento.expense_category ?? '';
    const descripcion = texto(concepto);
    let motivo;
    let accion;
    if (categoria === 'anticipo_prestamo' || /\b(prestamo|adelanto|anticipo)\b/.test(descripcion)) {
      motivo = 'Préstamo o anticipo';
      accion = 'Vincular la entrega con sus descuentos o devoluciones. Confirmar saldo antes de descontarlo como gasto.';
    } else if (/\b(gasolina|combustible)\b/.test(descripcion)) {
      motivo = 'Dinero para combustible';
      accion = 'Confirmar negocio, vehículo y comprobante de consumo; revisar si también se descontó en nómina.';
    } else if (/\b(credito|capital|intereses|mensualidad)\b/.test(descripcion)) {
      motivo = 'Posible pago de crédito';
      accion = 'Confirmar titular y separar capital, intereses y cargos con el estado del crédito.';
    } else if (/\b(personal|aportacion|reembolso)\b/.test(descripcion) || categoria === 'retiro_propietaria') {
      motivo = 'Dinero personal o de propietaria';
      accion = 'Confirmar si es retiro, aportación o reembolso y a qué negocio corresponde.';
    } else if (texto(movimiento.estado ?? movimiento.status) === 'pendiente de revision') {
      motivo = 'Clasificación pendiente';
      accion = 'Comparar concepto y comprobante con caja SICAR y banco antes de cerrar el movimiento.';
    } else return [];
    return [{ movimiento, motivo, accion }];
  });
}
