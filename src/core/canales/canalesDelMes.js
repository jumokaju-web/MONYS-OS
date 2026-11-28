/*
 * CANALES DEL MES DESDE LAS TABLAS SINCRONIZADAS · MONYS OS
 *
 * Arma, para cada cuenta configurada del negocio, el resumen del canal que
 * consume el estado de resultados, a partir de canal_ordenes /
 * canal_orden_items / canal_publicaciones (#170) y del costo SICAR por
 * vínculo (vinculacionSicar). Así el estado no confía en resúmenes
 * externos: todo sale de filas del negocio.
 *
 * Cobertura del mes: completa solo si la cuenta declara desde cuándo su
 * historial está completo (historico_desde ≤ inicio del mes) y su última
 * sincronización exitosa es posterior al cierre del mes. Si no, las ventas
 * quedan como registradas, no como ingreso del mes.
 * Módulo puro.
 */
import { resumirOrdenesMarketplace } from "./rentabilidadMarketplace.js";
import { vincularPublicaciones } from "./vinculacionSicar.js";

const mesLocal = (fecha) => {
  const p = new Date(String(fecha ?? ""));
  if (Number.isNaN(p.getTime())) return null;
  return new Date(p.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 7);
};
const finDeMes = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 1, 6)).toISOString(); // 00:00 CDMX del día 1 siguiente
};

function aFormaML(orden, items) {
  return {
    id: orden.external_id,
    fecha: orden.fecha,
    status: orden.estado,
    total: orden.total,
    comision_total: orden.comision,
    costo_envio_vendedor: orden.envio_vendedor,
    envio_estado: orden.envio_estado,
    money_release_date: orden.fecha_liberacion,
    cancel_group: orden.motivo_cancelacion,
    items: items.map((i) => ({
      item_id: i.publicacion,
      variation_id: i.variacion || null,
      title: i.titulo,
      sku: i.sku || null,
      cantidad: i.cantidad,
      precio_unit: i.precio_unit,
      sale_fee_total: i.comision,
    })),
  };
}

/*
 * cuentas:        canal_cuentas del negocio { id, canal, cuenta_externa, historico_desde, ultimo_sync, business_id }
 * ordenes:        canal_ordenes { id, cuenta_id, business_id, external_id, fecha, estado, total, comision, envio_vendedor, envio_estado, fecha_liberacion, motivo_cancelacion }
 * items:          canal_orden_items { orden_id, publicacion, variacion, titulo, sku, cantidad, precio_unit, comision }
 * publicaciones:  canal_publicaciones { cuenta_id, publicacion, variacion, sku, codigo_barras, titulo, canal }
 * productosSicar: [{ codigo, codigo_barras, costo, descripcion }]
 * vinculos:       producto_vinculos { canal, publicacion, codigo_sicar }
 * publicidadPorCuenta: { [cuentaId]: gasto del mes } (null/ausente = desconocido)
 * basesIva:       { [canal]: { ventas: {base, ivaPct}, cargos: {base, ivaPct} } }
 */
export function canalesDelMes({ businessId, mes, cuentas = [], ordenes = [], items = [], publicaciones = [], productosSicar = [], vinculos = [], publicidadPorCuenta = {}, basesIva = {}, hoy = null } = {}) {
  const propias = (cuentas || []).filter((c) => String(c.business_id) === String(businessId));
  const itemsPorOrden = new Map();
  for (const i of items || []) {
    if (!itemsPorOrden.has(String(i.orden_id))) itemsPorOrden.set(String(i.orden_id), []);
    itemsPorOrden.get(String(i.orden_id)).push(i);
  }
  return propias.map((cuenta) => {
    const delMes = (ordenes || []).filter((o) => String(o.cuenta_id) === String(cuenta.id) && String(o.business_id) === String(businessId) && mesLocal(o.fecha) === mes);
    const pubs = (publicaciones || []).filter((p) => String(p.cuenta_id) === String(cuenta.id));
    const vinculacion = vincularPublicaciones({
      publicaciones: pubs.map((p) => ({ ...p, canal: cuenta.canal })),
      productosSicar,
      vinculosManuales: (vinculos || []).filter((v) => v.canal === cuenta.canal),
    });
    const resumen = resumirOrdenesMarketplace(
      delMes.map((o) => aFormaML(o, itemsPorOrden.get(String(o.id)) || [])),
      { canal: cuenta.canal, costosPorPublicacion: vinculacion.costosPorPublicacion, hoy }
    );
    const historico = cuenta.historico_desde ? String(cuenta.historico_desde).slice(0, 10) : null;
    const coberturaCompleta = Boolean(historico && historico <= `${mes}-01` && cuenta.ultimo_sync && String(new Date(cuenta.ultimo_sync).toISOString()) >= finDeMes(mes));
    const publicidad = publicidadPorCuenta?.[cuenta.id];
    return {
      cuentaId: String(cuenta.id),
      cuentaExterna: cuenta.cuenta_externa ?? null,
      resumen: { ...resumen, canal: cuenta.canal },
      operaciones: delMes.map((o) => String(o.external_id)),
      coberturaCompleta,
      motivoCobertura: coberturaCompleta
        ? null
        : !historico
          ? "la cuenta no declara desde cuándo su historial está completo"
          : historico > `${mes}-01`
            ? `historial completo solo desde ${historico}`
            : "la última sincronización es anterior al cierre del mes",
      publicidad: publicidad === undefined ? null : publicidad,
      baseIvaVentas: basesIva?.[cuenta.canal]?.ventas,
      baseIvaCargos: basesIva?.[cuenta.canal]?.cargos,
      vinculacion: vinculacion.resumen,
      porVincular: vinculacion.pendientes.map((p) => ({ publicacion: p.publicacion, titulo: p.titulo, motivo: p.motivo, sugerencias: (p.sugerencias || []).slice(0, 3) })),
    };
  });
}
