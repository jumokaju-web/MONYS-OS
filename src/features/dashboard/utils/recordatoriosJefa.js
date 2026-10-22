function fechaValida(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function diasDesde(fecha, ahora) {
  const fechaValor = fechaValida(fecha);
  const ahoraValor = fechaValida(ahora);
  if (!fechaValor || !ahoraValor) return Number.POSITIVE_INFINITY;
  return Math.floor((ahoraValor.getTime() - fechaValor.getTime()) / 86400000);
}

export function construirRecordatoriosJefa({
  sucursales = [],
  importaciones = [],
  ultimoSaldo = null,
  ahora = new Date(),
} = {}) {
  const ramasActivas = (Array.isArray(sucursales) ? sucursales : [])
    .filter((sucursal) => sucursal?.active !== false && sucursal?.id)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es-MX"));
  const cargas = Array.isArray(importaciones) ? importaciones : [];
  const recordatorios = [];

  for (const sucursal of ramasActivas) {
    const ultimaImportacion = cargas.find((importacion) =>
      String(importacion?.branch_id || "") === String(sucursal.id)
    );
    const diasSinImportar = diasDesde(ultimaImportacion?.created_at, ahora);

    if (diasSinImportar >= 7) {
      const fecha = ultimaImportacion?.created_at
        ? String(ultimaImportacion.created_at).slice(0, 10)
        : null;
      recordatorios.push({
        id: `sicar-${sucursal.id}`,
        prioridad: "alta",
        tipo: "importador",
        titulo: `Actualizar base SICAR · ${sucursal.name || "sucursal"}`,
        detalle: fecha
          ? `Última carga de Ventas por artículo registrada en MONYS: ${fecha}. Los archivos enviados al chat no se cargan automáticamente aquí.`
          : `No hay una carga de Ventas por artículo registrada en MONYS para ${sucursal.name || "esta sucursal"}.`,
        boton: "Subir reporte",
        branchId: sucursal.id,
      });
    }
  }

  const diasSinActualizarBanco = diasDesde(ultimoSaldo, ahora);
  if (diasSinActualizarBanco >= 7) {
    recordatorios.push({
      id: "actualizar-bancos",
      prioridad: "alta",
      tipo: "tesoreria",
      titulo: "Actualizar movimientos bancarios",
      detalle: ultimoSaldo
        ? `Han pasado ${diasSinActualizarBanco} días desde la última confirmación bancaria.`
        : "Todavía no existe un saldo bancario confirmado.",
      boton: "Ir a Tesorería",
    });
  }

  return recordatorios;
}
