function importeRegistrado(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function pendientesResultadosMarketing(campanas = [], ahora = Date.now()) {
  const campos = [['venta', 'ventaAcumulada', 'Ventas'], ['pedidos', 'pedidosAcumulados', 'Pedidos'], ['gasto', 'gastoAcumulado', 'Gasto']];
  return campanas.filter((c) => c.estado === 'ACTIVA').flatMap((campana) => {
    const resultado = campana.resultado || {};
    const confirmado = (clave, campo) => {
      const importe = importeRegistrado(resultado[campo]);
      return importe !== null && (resultado.camposConfirmados?.[clave] === true || importe > 0);
    };
    const faltantes = campos.filter(([clave, campo]) => !confirmado(clave, campo)).map(([, , etiqueta]) => etiqueta);
    const gasto = confirmado('gasto', 'gastoAcumulado') ? importeRegistrado(resultado.gastoAcumulado) : null;
    const venta = confirmado('venta', 'ventaAcumulada') ? importeRegistrado(resultado.ventaAcumulada) : null;
    const presupuesto = importeRegistrado(campana.presupuesto);
    const fechas = (Array.isArray(resultado.historial) ? resultado.historial : []).map((r) => Date.parse(r.registradoEn)).filter((fecha) => Number.isFinite(fecha) && fecha <= ahora);
    const ultimaActualizacion = fechas.length ? Math.max(...fechas) : null;
    const horasSinResultados = ultimaActualizacion !== null ? Math.floor((ahora - ultimaActualizacion) / 3600000) : null;
    let prioridad = 3;
    let motivo = 'Resultados incompletos';
    let accion = `Confirmar ${faltantes.join(', ').toLowerCase()} con evidencia real.`;
    if (gasto > 0 && presupuesto !== null && gasto > presupuesto) {
      prioridad = 0; motivo = 'Gasto registrado supera el presupuesto';
      accion = 'Revisar autorizaciones y comprobantes con Mónica antes de comprometer más presupuesto.';
    } else if (gasto > 0 && venta === null) {
      prioridad = 1; motivo = 'Hay gasto; falta confirmar ventas';
      accion = 'Completar ventas y pedidos para que Mónica pueda evaluar el uso del presupuesto.';
    } else if (gasto > 0 && venta === 0) {
      prioridad = 2; motivo = 'Gasto con cero ventas confirmado';
      accion = 'Revisar ejecución, contactos y pedidos pendientes antes de recomendar nueva inversión. Esto no demuestra pérdida por sí solo.';
    } else if (horasSinResultados !== null && horasSinResultados >= 48) {
      prioridad = 3; motivo = 'Resultados sin actualizar por 48 horas o más';
      accion = 'Registrar únicamente los resultados nuevos desde el último seguimiento.';
    } else if (!faltantes.length) return [];
    return [{ campana, faltantes, gasto, venta, presupuesto, prioridad, motivo, accion, horasSinResultados }];
  }).sort((a, b) => a.prioridad - b.prioridad || (b.gasto ?? -1) - (a.gasto ?? -1) || String(a.campana.id).localeCompare(String(b.campana.id)));
}
