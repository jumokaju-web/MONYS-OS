export function calcularMargenComercial(precioCompra, precioVenta) {
  const costo = Number(precioCompra);
  const venta = Number(precioVenta);
  if (!Number.isFinite(costo) || !Number.isFinite(venta) || costo <= 0 || venta <= 0 || venta < costo) return null;
  return ((venta - costo) / venta) * 100;
}
