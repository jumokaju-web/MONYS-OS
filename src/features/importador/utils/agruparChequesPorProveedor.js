function normalizarNombre(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function claveProveedor(proveedor) {
  if (proveedor?.id) return `id:${proveedor.id}`;
  const numero = String(proveedor?.numero_proveedor || proveedor?.numeroProveedor || "").trim();
  if (numero) return `numero:${numero}`;
  const nombre = normalizarNombre(proveedor?.nombre);
  return nombre.length >= 3 ? `nombre:${nombre}` : null;
}

export function agruparChequesPorProveedor(items = []) {
  const grupos = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const fila = item?.fila;
    const detalle = item?.detalle;
    const proveedores = fila?.proveedoresCandidatos;
    if (!detalle?.id || !fila?.fecha || !(Number(fila?.monto) > 0) || !Array.isArray(proveedores) || proveedores.length !== 1) continue;
    const proveedor = proveedores[0];
    const clave = claveProveedor(proveedor);
    if (!clave || String(proveedor.nombre || "").trim().length < 2) continue;
    const grupo = grupos.get(clave) || { clave, proveedor, items: [], centavos: 0 };
    grupo.items.push(item);
    grupo.centavos += Math.round(Number(fila.monto) * 100);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()]
    .filter((grupo) => grupo.items.length >= 2)
    .map((grupo) => ({ ...grupo, total: grupo.centavos / 100 }))
    .sort((a, b) => b.total - a.total || a.proveedor.nombre.localeCompare(b.proveedor.nombre, "es-MX"));
}
