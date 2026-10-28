const METODOS_ATRIBUIBLES = new Set(["CH", "EF"]);

/** Agrupa pagos con cruce SICAR único, sin incluir movimientos ya atribuidos. */
export function agruparAbonosEnlazables(filas = [], pagosGuardados = new Set()) {
  const grupos = new Map();
  for (const fila of Array.isArray(filas) ? filas : []) {
    if (!METODOS_ATRIBUIBLES.has(fila?.metodoPago) || fila?.estadoCruce !== "COINCIDENCIA_UNICA") continue;
    const detalle = fila.coincidencias?.[0];
    if (!detalle?.id || pagosGuardados.has(detalle.id)) continue;
    const nombre = String(fila.proveedorNombre || "").trim();
    if (nombre.length < 2 || !(Number(fila.monto) > 0)) continue;

    const clave = `${nombre.toLocaleLowerCase("es-MX")}|${fila.metodoPago}`;
    const grupo = grupos.get(clave) || { clave, nombre, metodoPago: fila.metodoPago, items: [], totalCentavos: 0 };
    grupo.items.push({ fila, detalle });
    grupo.totalCentavos += Math.round(Number(fila.monto) * 100);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].map((grupo) => ({ ...grupo, total: grupo.totalCentavos / 100 }));
}
