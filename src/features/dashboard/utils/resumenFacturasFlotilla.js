export function resumirFacturasFlotilla(facturas = []) {
  const vigentes = (Array.isArray(facturas) ? facturas : []).filter((factura) =>
    String(factura?.estado_pago || "").toUpperCase() !== "CANCELADA",
  );
  const totalFacturado = vigentes.reduce((total, factura) => total + (Number(factura?.total) || 0), 0);
  const conciliadas = vigentes.filter((factura) => factura.estado_conciliacion === "CONCILIADA");
  const pendientes = vigentes.filter((factura) => factura.estado_conciliacion !== "CONCILIADA");
  return {
    cantidad: vigentes.length,
    totalFacturado: Math.round((totalFacturado + Number.EPSILON) * 100) / 100,
    cantidadConciliada: conciliadas.length,
    totalConciliado: Math.round((conciliadas.reduce((total, factura) => total + (Number(factura.total) || 0), 0) + Number.EPSILON) * 100) / 100,
    cantidadPendiente: pendientes.length,
  };
}
