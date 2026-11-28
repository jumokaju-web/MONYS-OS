/*
 * RENTABILIDAD DE MARKETPLACES · MONYS OS (Mercado Libre, TikTok Shop)
 *
 * Entrada: órdenes normalizadas con la forma que entrega la conexión de
 * Mercado Libre (por orden: id, fecha, status, total, comision_total,
 * costo_envio_vendedor, envio_estado, neto, money_release_date,
 * cancel_group, items[{ sku, cantidad, precio_unit, sale_fee_total }]).
 * TikTok Shop usará el mismo contrato cuando exista su fuente de órdenes.
 *
 * Reglas:
 * - Venta = orden pagada; canceladas se reportan aparte (no son venta).
 * - Envío desconocido → neto null (no se asume cero).
 * - Retenciones de impuestos: la API no las expone; solo se calculan con
 *   un % configurado. Sin él, quedan null y como faltante.
 * - El depósito liquida ventas ya registradas: liberado/pendiente son
 *   flujo de caja, no venta nueva.
 * - Costo del producto: desde SICAR por SKU. Sin SKU o sin costo, la
 *   utilidad del renglón queda null.
 * Módulo puro.
 */

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

const redondear = (valor) => Math.round(valor * 100) / 100;
const clave = (sku) => String(sku ?? "").trim().toUpperCase();

const MOTIVOS_CANCELACION = {
  seller: "cancelada por el vendedor",
  fraud: "riesgo de fraude",
  internal: "cancelada por la plataforma",
  buyer: "cancelada por el comprador",
};

/*
 * costosPorSku: { [SKU]: costo unitario } desde SICAR.
 * retencionPct: % de ISR/IVA que retiene la plataforma (0–30) o null.
 * hoy: fecha ISO para separar liberado de pendiente.
 */
export function resumirOrdenesMarketplace(ordenes = [], { canal = "mercado_libre", costosPorSku = {}, costosPorPublicacion = {}, retencionPct = null, hoy = null } = {}) {
  const referencia = hoy ? new Date(hoy) : new Date();
  const costos = Object.fromEntries(Object.entries(costosPorSku || {}).map(([sku, costo]) => [clave(sku), numero(costo)]));
  const costosPublicacion = Object.fromEntries(Object.entries(costosPorPublicacion || {}).map(([id, costo]) => [String(id), numero(costo)]));
  const retencion = numero(retencionPct);
  const retencionValida = retencion !== null && retencion >= 0 && retencion <= 30;

  const faltantes = [];
  const pagadas = [];
  const canceladas = { ordenes: 0, monto: 0, porMotivo: {} };
  let otrosEstados = 0;

  for (const orden of ordenes || []) {
    const estado = String(orden?.status || "").toLowerCase();
    const total = numero(orden?.total);
    if (estado === "cancelled") {
      canceladas.ordenes += 1;
      canceladas.monto += total ?? 0;
      const motivo = MOTIVOS_CANCELACION[orden?.cancel_group] || "sin motivo informado";
      canceladas.porMotivo[motivo] = (canceladas.porMotivo[motivo] || 0) + 1;
      continue;
    }
    if (estado !== "paid") {
      otrosEstados += 1;
      continue;
    }
    pagadas.push(orden);
  }

  let venta = 0;
  let comisiones = 0;
  let envios = 0;
  let enviosCompletos = true;
  let liberado = 0;
  let pendiente = 0;
  let liberacionCompleta = true;
  const porSku = new Map();

  for (const orden of pagadas) {
    const total = numero(orden.total) ?? 0;
    const comision = numero(orden.comision_total) ?? 0;
    const envio = orden.envio_estado === "sin_envio" ? 0 : numero(orden.costo_envio_vendedor);
    venta += total;
    comisiones += comision;
    if (envio === null) enviosCompletos = false;
    else envios += envio;

    const neto = envio === null ? null : total - comision - envio;
    const liberacion = new Date(orden.money_release_date);
    if (neto === null || Number.isNaN(liberacion.getTime())) liberacionCompleta = false;
    else if (liberacion <= referencia) liberado += neto;
    else pendiente += neto;

    // Reparte el envío de la orden entre sus renglones por importe.
    for (const item of orden.items || []) {
      const cantidad = numero(item?.cantidad) ?? 0;
      const importe = (numero(item?.precio_unit) ?? 0) * cantidad;
      const sku = clave(item?.sku) || null;
      const id = sku || `SIN_SKU:${item?.item_id || item?.title || "?"}`;
      const fila = porSku.get(id) || {
        sku,
        publicacion: item?.item_id || null,
        titulo: item?.title || "",
        unidades: 0,
        venta: 0,
        comision: 0,
        envio: 0,
        envioCompleto: true,
      };
      fila.unidades += cantidad;
      fila.venta += importe;
      fila.comision += numero(item?.sale_fee_total) ?? 0;
      if (envio === null) fila.envioCompleto = false;
      else if (total > 0) fila.envio += envio * (importe / total);
      porSku.set(id, fila);
    }
  }

  if (!enviosCompletos) faltantes.push("costo de envío de algunas ventas (neto incompleto)");
  if (!retencionValida) faltantes.push(`% de retenciones de ISR/IVA de ${canal === "mercado_libre" ? "Mercado Libre" : canal} (la API no lo expone)`);
  if (!liberacionCompleta) faltantes.push("fecha de liberación de algunas ventas");

  const netoAntesRetenciones = enviosCompletos ? venta - comisiones - envios : null;
  const retenciones = retencionValida ? venta * (retencion / 100) : null;

  const skus = [...porSku.values()].map((fila) => {
    const costoUnitario =
      (fila.publicacion ? costosPublicacion[String(fila.publicacion)] ?? null : null) ??
      (fila.sku ? costos[fila.sku] ?? null : null);
    const neto = fila.envioCompleto ? fila.venta - fila.comision - fila.envio : null;
    const retencionFila = retencionValida ? fila.venta * (retencion / 100) : null;
    const costoProducto = costoUnitario === null ? null : costoUnitario * fila.unidades;
    const utilidad =
      neto === null || costoProducto === null || retencionFila === null ? null : neto - retencionFila - costoProducto;
    let motivo = "";
    if (costoUnitario === null && !fila.sku) motivo = "publicación sin SKU ni vínculo con SICAR: vincúlala para conocer su costo";
    else if (costoUnitario === null) motivo = `SKU ${fila.sku} sin costo en SICAR: vincúlalo`;
    else if (retencionFila === null) motivo = "falta % de retenciones";
    return {
      sku: fila.sku,
      publicacion: fila.publicacion,
      titulo: fila.titulo,
      unidades: fila.unidades,
      venta: redondear(fila.venta),
      comision: redondear(fila.comision),
      envio: fila.envioCompleto ? redondear(fila.envio) : null,
      cargosPct: fila.envioCompleto && fila.venta > 0 ? Math.round(((fila.comision + fila.envio) / fila.venta) * 1000) / 10 : null,
      netoAntesRetenciones: neto === null ? null : redondear(neto),
      costoProducto: costoProducto === null ? null : redondear(costoProducto),
      utilidad: utilidad === null ? null : redondear(utilidad),
      margenPct: utilidad === null || fila.venta === 0 ? null : Math.round((utilidad / fila.venta) * 1000) / 10,
      pierdeDinero: utilidad === null ? null : utilidad < 0,
      motivo,
    };
  }).sort((a, b) => b.venta - a.venta);

  const utilidades = skus.map((fila) => fila.utilidad);
  const utilidadTotal = utilidades.length && utilidades.every((valor) => valor !== null)
    ? redondear(utilidades.reduce((suma, valor) => suma + valor, 0))
    : null;
  if (skus.some((fila) => fila.utilidad === null)) faltantes.push("costo de SICAR por SKU en algunas publicaciones");

  const totalOrdenes = pagadas.length + canceladas.ordenes;
  return {
    canal,
    tipo: "ESTIMACION",
    ventasPagadas: redondear(venta),
    ordenesPagadas: pagadas.length,
    unidades: skus.reduce((suma, fila) => suma + fila.unidades, 0),
    canceladas: { ...canceladas, monto: redondear(canceladas.monto) },
    tasaCancelacionPct: totalOrdenes ? Math.round((canceladas.ordenes / totalOrdenes) * 1000) / 10 : null,
    otrosEstados,
    comisiones: redondear(comisiones),
    envios: enviosCompletos ? redondear(envios) : null,
    cargosPct: enviosCompletos && venta > 0 ? Math.round(((comisiones + envios) / venta) * 1000) / 10 : null,
    netoAntesRetenciones: netoAntesRetenciones === null ? null : redondear(netoAntesRetenciones),
    retenciones: retenciones === null ? null : redondear(retenciones),
    flujo: {
      liberado: liberacionCompleta ? redondear(liberado) : null,
      pendienteDeLiberar: liberacionCompleta ? redondear(pendiente) : null,
      nota: "Depósitos que liquidan ventas ya contadas: son caja, no venta nueva.",
    },
    utilidad: utilidadTotal,
    porSku: skus,
    productosConPerdida: skus.filter((fila) => fila.pierdeDinero === true),
    faltantes: [...new Set(faltantes)],
  };
}

/*
 * Consolidado de Monys Glam por canal sin duplicar ventas.
 * canales: [{ canal, ventasPagadas, utilidad, registradoEnSicar }]
 * Si un canal también se registra en SICAR (registradoEnSicar === true),
 * su venta ya está en ventaSicar: no se vuelve a sumar. Si no se sabe
 * (null), el consolidado queda pendiente.
 */
export function consolidarCanales({ ventaSicar = null, canales = [] } = {}) {
  const sicar = numero(ventaSicar);
  const desconocidos = (canales || []).filter((item) => item.registradoEnSicar !== true && item.registradoEnSicar !== false);
  const faltantes = [];
  if (sicar === null) faltantes.push("venta de tienda en SICAR");
  if (desconocidos.length) {
    faltantes.push(`confirmar si las ventas de ${desconocidos.map((item) => item.canal).join(", ")} también se registran en SICAR`);
  }
  const adicionales = (canales || []).filter((item) => item.registradoEnSicar === false);
  const ventaTotal = faltantes.length
    ? null
    : redondear(sicar + adicionales.reduce((suma, item) => suma + (numero(item.ventasPagadas) ?? 0), 0));
  return {
    ventaTotal,
    participacion: ventaTotal
      ? Object.fromEntries([
          ["tienda_sicar", Math.round((sicar / ventaTotal) * 1000) / 10],
          ...(canales || []).map((item) => [
            item.canal,
            item.registradoEnSicar ? null : Math.round(((numero(item.ventasPagadas) ?? 0) / ventaTotal) * 1000) / 10,
          ]),
        ])
      : null,
    faltantes,
  };
}
