/*
 * ESTADO DE RESULTADOS MENSUAL POR SUCURSAL Y CANAL · MONYS OS
 *
 * Un negocio (Monys Glam) por estado; flotilla va en su propio negocio.
 *
 *   Ingresos
 * − Costo de mercancía (SICAR)
 * = Utilidad bruta
 * − Gastos de venta del canal (comisiones, envíos, publicidad)
 * − Gastos operativos directos (Tesorería con sucursal)
 * = Contribución de la unidad (sucursal o canal)
 * − Gastos generales (Tesorería sin sucursal; no se reparten)
 * = Utilidad operativa
 * − Intereses
 * = Utilidad antes de ISR
 * − ISR (del contador o estimado con su tasa)
 * = Utilidad neta
 *
 * Reglas:
 * - Dato faltante ≠ 0: si falta una pieza, el renglón y los que dependen
 *   de él quedan en null y la pieza aparece en `faltantes`.
 * - Ingresos sin IVA. Si no se confirma si el reporte trae IVA, se usan
 *   los importes tal como vienen, se marca la base "por_confirmar" y no se
 *   calcula ISR ni utilidad neta.
 * - IVA pagado, retenciones, capital de deuda, compras de inventario,
 *   retiros y traspasos NO son gasto: se informan aparte.
 * - Las comisiones de marketplace que ya vienen en las órdenes no se
 *   vuelven a restar si también están en Tesorería.
 * - Gastos en base pagado (Tesorería). Se declara en `bases`.
 * - Los gastos generales no se reparten entre sucursales: repartirlos por
 *   ventas es un supuesto y se informa aparte, nunca mezclado.
 * Módulo puro: sin Supabase ni React.
 */
import { NATURALEZAS, clasificarMovimiento } from "./conciliacionGastos.js";

const r2 = (valor) => (valor === null || valor === undefined ? null : Math.round(valor * 100) / 100);
const r1 = (valor) => (valor === null || valor === undefined ? null : Math.round(valor * 10) / 10);
const texto = (valor) => String(valor ?? "").trim().toLowerCase();

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

const restar = (a, ...bs) => (a === null || bs.some((b) => b === null) ? null : a - bs.reduce((s, b) => s + b, 0));
const sumarTodos = (valores) => (valores.length && valores.every((v) => v !== null) ? valores.reduce((s, v) => s + v, 0) : null);
const pct = (parte, total) => (parte === null || total === null || total === 0 ? null : (parte / total) * 100);

export const BASES_IVA = Object.freeze({ SIN_IVA: "sin_iva", CON_IVA: "con_iva", POR_CONFIRMAR: "por_confirmar" });
const ORDEN_CONFIANZA = { baja: 0, media: 1, alta: 2 };
const minConfianza = (...niveles) => niveles.filter(Boolean).reduce((a, b) => (ORDEN_CONFIANZA[b] < ORDEN_CONFIANZA[a] ? b : a), "alta");

export function mesLocal(fecha) {
  const valor = String(fecha ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.slice(0, 7);
  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 7);
}

/*
 * Convierte un importe a sin IVA según la base declarada.
 * base: sin_iva | con_iva (requiere ivaPct) | por_confirmar/null.
 */
function quitarIva(importe, { base, ivaPct }) {
  if (importe === null) return null;
  if (base === BASES_IVA.SIN_IVA) return importe;
  if (base === BASES_IVA.CON_IVA) return ivaPct === null ? null : importe / (1 + ivaPct / 100);
  return importe; // por confirmar: tal como viene, marcado
}

function leerBase(baseIva = {}) {
  const base = Object.values(BASES_IVA).includes(baseIva?.base) ? baseIva.base : BASES_IVA.POR_CONFIRMAR;
  const ivaPct = numero(baseIva?.ivaPct);
  return { base, ivaPct: ivaPct !== null && ivaPct >= 0 && ivaPct < 100 ? ivaPct : null };
}

/*
 * Varias cargas de SICAR pueden cubrir los mismos días (recargas,
 * correcciones). Para cada sucursal y día se usan solo las filas de la
 * carga más reciente que trae ese día: nunca se suman dos cargas.
 * filas: [{ importacion_id, fecha, ... }]
 * importaciones: [{ id, branch_id, created_at }]
 * Devuelve las filas elegidas con branch_id y cuántas se descartaron.
 */
export function filasSinCargasDuplicadas(filas = [], importaciones = []) {
  const cargas = new Map((importaciones || []).map((imp) => [String(imp.id), imp]));
  const ganadora = new Map();
  for (const fila of filas || []) {
    const carga = cargas.get(String(fila?.importacion_id));
    const dia = String(fila?.fecha ?? "").slice(0, 10);
    if (!carga || !carga.branch_id || !dia) continue;
    const clave = `${carga.branch_id}|${dia}`;
    const actual = ganadora.get(clave);
    if (!actual || String(carga.created_at) > String(actual.created_at) || (String(carga.created_at) === String(actual.created_at) && String(carga.id) > String(actual.id))) {
      ganadora.set(clave, carga);
    }
  }
  const elegidas = [];
  let descartadas = 0;
  for (const fila of filas || []) {
    const carga = cargas.get(String(fila?.importacion_id));
    const dia = String(fila?.fecha ?? "").slice(0, 10);
    if (!carga || !carga.branch_id || !dia) { descartadas += 1; continue; }
    if (ganadora.get(`${carga.branch_id}|${dia}`)?.id !== carga.id) { descartadas += 1; continue; }
    elegidas.push({ ...fila, branch_id: carga.branch_id });
  }
  return { filas: elegidas, descartadas };
}

/*
 * Agrega filas de ventas_articulos (SICAR) por sucursal y mes.
 * Costo de mercancía = importe − utilidad del propio reporte SICAR (no se
 * asume si la columna costo es unitaria o total). Una fila sin
 * importe o utilidad disponibles deja el mes de esa sucursal incompleto.
 * filas: [{ branch_id, fecha, importe, utilidad, importe_disponible, utilidad_disponible }]
 */
export function agregarVentasSicarPorMes(filas = []) {
  const grupos = new Map();
  for (const fila of filas || []) {
    const mes = mesLocal(fila?.fecha);
    const unidad = fila?.branch_id ? String(fila.branch_id) : null;
    if (!mes || !unidad) continue;
    const clave = `${unidad}|${mes}`;
    if (!grupos.has(clave)) grupos.set(clave, { unidad, mes, ingresos: 0, costo: 0, filas: 0, incompletas: 0 });
    const grupo = grupos.get(clave);
    grupo.filas += 1;
    const importe = fila?.importe_disponible === false ? null : numero(fila?.importe);
    const utilidad = fila?.utilidad_disponible === false ? null : numero(fila?.utilidad);
    if (importe === null || utilidad === null) {
      grupo.incompletas += 1;
      continue;
    }
    grupo.ingresos += importe;
    grupo.costo += importe - utilidad;
  }
  return [...grupos.values()].map((g) => ({
    unidad: g.unidad,
    tipo: "sucursal",
    mes: g.mes,
    ingresos: g.incompletas ? null : r2(g.ingresos),
    costoMercancia: g.incompletas ? null : r2(g.costo),
    filas: g.filas,
    filasIncompletas: g.incompletas,
  }));
}

/*
 * Resultado de un canal desde el resumen de rentabilidadMarketplace (#169):
 * { canal, ventasPagadas, comisiones, envios, porSku:[{costoProducto, utilidad, pierdeDinero, ...}],
 *   tasaCancelacionPct, productosConPerdida, cargosPct }
 * publicidad: gasto de ads del mes (null = desconocido, no 0).
 */
function unidadDeCanal(resumen, { publicidad = null, baseIva } = {}) {
  const faltantes = [];
  const base = leerBase(baseIva);
  const ventas = numero(resumen?.ventasPagadas);
  const costos = (resumen?.porSku || []).map((f) => numero(f?.costoProducto));
  const costoMercancia = sumarTodos(costos) ?? (costos.length ? null : ventas === 0 ? 0 : null);
  if (costoMercancia === null) faltantes.push(`${resumen?.canal}: costo SICAR de publicaciones sin vincular`);
  const comisiones = numero(resumen?.comisiones);
  const envios = numero(resumen?.envios);
  const ads = numero(publicidad);
  if (comisiones === null) faltantes.push(`${resumen?.canal}: comisiones`);
  if (envios === null) faltantes.push(`${resumen?.canal}: costo de envíos`);
  if (ads === null) faltantes.push(`${resumen?.canal}: gasto de publicidad del mes`);
  if (base.base === BASES_IVA.POR_CONFIRMAR) faltantes.push(`${resumen?.canal}: confirmar si el precio de venta incluye IVA`);
  if (base.base === BASES_IVA.CON_IVA && base.ivaPct === null) faltantes.push(`${resumen?.canal}: % de IVA`);
  // Los cargos de la plataforma se cobran sobre el precio con IVA y se
  // facturan con IVA acreditable: se toman sin IVA con la misma base.
  const sinIva = (v) => quitarIva(v, base);
  return {
    unidad: String(resumen?.canal),
    tipo: "canal",
    baseIva: base.base,
    ingresos: sinIva(ventas),
    costoMercancia,
    gastosVenta: { comisiones: sinIva(comisiones), envios: sinIva(envios), publicidad: sinIva(ads) },
    indicadores: {
      tasaCancelacionPct: numero(resumen?.tasaCancelacionPct),
      cargosPct: numero(resumen?.cargosPct),
      productosConPerdida: (resumen?.productosConPerdida || []).map((p) => ({
        sku: p.sku, publicacion: p.publicacion, titulo: p.titulo, utilidad: numero(p.utilidad), unidades: p.unidades,
      })),
    },
    faltantes,
  };
}

/*
 * Clasifica los movimientos del mes (ya expandidos con distribuciones,
 * ver expandirDistribuciones de #166) por unidad y renglón.
 */
function gastosDelMes(movimientos = [], mes, { hayComisionesDeCanal }) {
  const porUnidad = {};
  const generales = {};
  const fueraDeResultados = { iva: 0, isrPagado: 0, impuestosSinTipo: 0, capitalDeuda: 0, compraInventario: 0, retiros: 0, financiamiento: 0, traspasos: 0 };
  let intereses = 0;
  const sinClasificar = [];
  const excluidosPorDuplicado = [];
  let considerados = 0;
  let pendientesRevision = 0;

  for (const mov of movimientos || []) {
    if (texto(mov?.status) === "cancelado") continue;
    if (mesLocal(mov?.occurred_at) !== mes) continue;
    if (texto(mov?.movement_type ?? mov?.tipo) !== "salida") continue;
    const importe = numero(mov?.amount);
    if (importe === null || importe <= 0) {
      sinClasificar.push({ id: mov?.id, motivo: "Importe inválido." });
      continue;
    }
    considerados += 1;
    if (texto(mov?.status) !== "revisado") pendientesRevision += 1;
    const { naturaleza, esGasto, motivo } = clasificarMovimiento(mov);
    if (texto(mov?.expense_category) === "comisiones_marketplace" && hayComisionesDeCanal) {
      excluidosPorDuplicado.push({ id: mov?.id, importe, motivo: "Comisión de marketplace ya restada desde las órdenes." });
      continue;
    }
    if (esGasto) {
      const destino = mov?.branch_id ? (porUnidad[String(mov.branch_id)] ||= {}) : generales;
      destino[naturaleza] = (destino[naturaleza] || 0) + importe;
      continue;
    }
    switch (naturaleza) {
      case NATURALEZAS.INTERESES: intereses += importe; break;
      case NATURALEZAS.IMPUESTO_IVA: fueraDeResultados.iva += importe; break;
      case NATURALEZAS.IMPUESTO_ISR: fueraDeResultados.isrPagado += importe; break;
      case NATURALEZAS.IMPUESTOS: fueraDeResultados.impuestosSinTipo += importe; break;
      case NATURALEZAS.CAPITAL_DEUDA: fueraDeResultados.capitalDeuda += importe; break;
      case NATURALEZAS.COMPRA_INVENTARIO: fueraDeResultados.compraInventario += importe; break;
      case NATURALEZAS.RETIRO_PROPIETARIA: fueraDeResultados.retiros += importe; break;
      case NATURALEZAS.FINANCIAMIENTO: fueraDeResultados.financiamiento += importe; break;
      case NATURALEZAS.TRASPASO: fueraDeResultados.traspasos += importe; break;
      case NATURALEZAS.AJUSTE: break;
      default: sinClasificar.push({ id: mov?.id, concepto: mov?.concept || "", importe, motivo: motivo || "Sin clasificar." });
    }
  }
  return { considerados, pendientesRevision, porUnidad, generales, intereses, fueraDeResultados, sinClasificar, excluidosPorDuplicado };
}

const totalDe = (porNaturaleza) => Object.values(porNaturaleza || {}).reduce((s, v) => s + v, 0);
const redondearMapa = (mapa) => Object.fromEntries(Object.entries(mapa || {}).map(([k, v]) => [k, r2(v)]));

function lineasDeUnidad(u, gastosDirectos, hayMovimientos) {
  const ingresos = u.ingresos ?? null;
  const costo = u.costoMercancia ?? null;
  const utilidadBruta = restar(ingresos, costo);
  const gv = u.gastosVenta || null;
  const gastosVenta = gv ? sumarTodos([gv.comisiones, gv.envios, gv.publicidad]) : 0;
  const directos = hayMovimientos ? totalDe(gastosDirectos) : null;
  const contribucion = restar(utilidadBruta, gastosVenta, directos);
  return {
    unidad: u.unidad,
    nombre: u.nombre || u.unidad,
    tipo: u.tipo,
    baseIva: u.baseIva,
    ingresos: r2(ingresos),
    costoMercancia: r2(costo),
    utilidadBruta: r2(utilidadBruta),
    margenBrutoPct: r1(pct(utilidadBruta, ingresos)),
    gastosVenta: gv ? { comisiones: r2(gv.comisiones), envios: r2(gv.envios), publicidad: r2(gv.publicidad), total: r2(gastosVenta) } : null,
    gastosOperativosDirectos: directos === null ? null : { total: r2(directos), porNaturaleza: redondearMapa(gastosDirectos) },
    contribucion: r2(contribucion),
    margenContribucionPct: r1(pct(contribucion, ingresos)),
    indicadores: u.indicadores || null,
  };
}

/*
 * Estado de resultados de un negocio en un mes.
 *
 * ventasSucursal: salida de agregarVentasSicarPorMes (filtrada al negocio).
 * sucursales:     [{ id, name }] del negocio (todas: una sin ventas es dato
 *                 faltante, no cero, salvo cerradaConfirmada: true).
 * canales:        [{ resumen (rentabilidadMarketplace), publicidad, baseIva }]
 * movimientos:    líneas de Tesorería del mes ya expandidas.
 * baseIvaSicar:   { base: sin_iva|con_iva|por_confirmar, ivaPct }
 * intereses:      { devengados } (del motor de deudas); si no, se usan
 *                 los pagados en el mes, marcados como base pagado.
 * isr:            { montoDelContador } o { tasaEstimadaPct } (estimado).
 * canalesSinDatos: canales del negocio que aún no tienen datos del mes
 *                 (p. ej. sin sincronizar): el consolidado queda pendiente.
 * hoy:            YYYY-MM-DD para marcar el mes en curso como parcial.
 */
export function construirEstadoResultados({
  businessId,
  mes,
  ventasSucursal = [],
  sucursales = [],
  canales = [],
  movimientos = null,
  baseIvaSicar = {},
  intereses = {},
  isr = {},
  canalesSinDatos = [],
  hoy = null,
} = {}) {
  if (!businessId) return { calculable: false, faltantes: ["negocio"] };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ""))) return { calculable: false, faltantes: ["mes válido (YYYY-MM)"] };

  const faltantes = [];
  const baseSicar = leerBase(baseIvaSicar);
  if (baseSicar.base === BASES_IVA.POR_CONFIRMAR) faltantes.push("confirmar si las ventas de SICAR incluyen IVA");
  if (baseSicar.base === BASES_IVA.CON_IVA && baseSicar.ivaPct === null) faltantes.push("% de IVA de las ventas de SICAR");

  // Sucursales: cada una debe tener su mes; si no, es faltante.
  const ventasDelMes = (ventasSucursal || []).filter((v) => v.mes === mes);
  const unidadesSucursal = (sucursales || []).map((s) => {
    const fila = ventasDelMes.find((v) => String(v.unidad) === String(s.id));
    if (!fila && s.cerradaConfirmada) return { unidad: String(s.id), nombre: s.name, tipo: "sucursal", baseIva: baseSicar.base, ingresos: 0, costoMercancia: 0 };
    if (!fila) faltantes.push(`ventas de ${s.name || s.id} en ${mes}`);
    else if (fila.ingresos === null) faltantes.push(`${s.name || s.id}: ${fila.filasIncompletas} renglón(es) de SICAR sin importe o utilidad`);
    return {
      unidad: String(s.id),
      nombre: s.name,
      tipo: "sucursal",
      baseIva: baseSicar.base,
      ingresos: fila ? quitarIva(fila.ingresos, baseSicar) : null,
      costoMercancia: fila ? quitarIva(fila.costoMercancia, { base: BASES_IVA.SIN_IVA }) : null,
    };
  });

  for (const canal of canalesSinDatos || []) faltantes.push(`ventas de ${canal} en ${mes} (canal sin sincronizar)`);
  const unidadesCanal = (canales || []).map((c) => unidadDeCanal(c.resumen, { publicidad: c.publicidad ?? null, baseIva: c.baseIva }));
  unidadesCanal.forEach((u) => faltantes.push(...u.faltantes));

  const hayMovimientos = Array.isArray(movimientos);
  if (!hayMovimientos) faltantes.push("movimientos de Tesorería del mes (gastos)");
  const g = gastosDelMes(movimientos || [], mes, { hayComisionesDeCanal: unidadesCanal.some((u) => u.gastosVenta.comisiones !== null) });
  const idsSucursal = new Set(unidadesSucursal.map((u) => u.unidad));
  const gastosDeOtraSucursal = Object.keys(g.porUnidad).filter((id) => !idsSucursal.has(id));
  if (gastosDeOtraSucursal.length) faltantes.push(`gastos con sucursal ajena al negocio (${gastosDeOtraSucursal.length})`);
  if (g.sinClasificar.length) faltantes.push(`${g.sinClasificar.length} movimiento(s) sin clasificar`);

  const unidades = [
    ...unidadesSucursal.map((u) => lineasDeUnidad(u, g.porUnidad[u.unidad] || {}, hayMovimientos)),
    ...unidadesCanal.map((u) => lineasDeUnidad(u, {}, true)),
  ];

  // Consolidado del negocio.
  const canalesPendientes = (canalesSinDatos || []).length > 0;
  const ingresos = canalesPendientes ? null : sumarTodos(unidades.map((u) => u.ingresos));
  const costoMercancia = canalesPendientes ? null : sumarTodos(unidades.map((u) => u.costoMercancia));
  const utilidadBruta = restar(ingresos, costoMercancia);
  const gastosVenta = sumarTodos(unidades.filter((u) => u.gastosVenta).map((u) => u.gastosVenta.total));
  const directos = hayMovimientos ? sumarTodos(unidades.filter((u) => u.gastosOperativosDirectos).map((u) => u.gastosOperativosDirectos.total)) ?? 0 : null;
  const generales = hayMovimientos ? totalDe(g.generales) : null;
  // Si hay sin clasificar, los gastos podrían estar incompletos: se calcula
  // pero la confianza baja.
  const gastosOperativos = sumarTodos([gastosVenta ?? (unidadesCanal.length ? null : 0), directos, generales]);
  const utilidadOperativa = restar(utilidadBruta, gastosOperativos);

  const interesesDevengados = numero(intereses?.devengados);
  const interesesMonto = interesesDevengados ?? (hayMovimientos ? g.intereses : null);
  const baseIntereses = interesesDevengados !== null ? "devengado" : hayMovimientos ? "pagado_en_el_mes" : null;
  if (interesesMonto === null) faltantes.push("intereses del mes");
  const utilidadAntesISR = restar(utilidadOperativa, interesesMonto);

  const baseConfirmada = [baseSicar.base, ...unidadesCanal.map((u) => u.baseIva)].every((b) => b !== BASES_IVA.POR_CONFIRMAR);
  let isrMonto = null;
  let tipoIsr = null;
  const isrContador = numero(isr?.montoDelContador);
  const tasa = numero(isr?.tasaEstimadaPct);
  if (!baseConfirmada) faltantes.push("ISR: primero confirmar la base de IVA de las ventas");
  else if (isrContador !== null) { isrMonto = isrContador; tipoIsr = "DEL_CONTADOR"; }
  else if (tasa !== null && tasa >= 0 && tasa < 100 && utilidadAntesISR !== null) { isrMonto = Math.max(0, utilidadAntesISR) * (tasa / 100); tipoIsr = "ESTIMADO"; }
  else faltantes.push("ISR del mes (monto del contador o tasa para estimarlo)");
  const utilidadNeta = isrMonto === null ? null : restar(utilidadAntesISR, isrMonto);

  // Supuesto informativo: generales repartidos por ventas.
  const reparto = generales !== null && ingresos
    ? unidades.map((u) => {
        if (u.ingresos === null || u.contribucion === null) return { unidad: u.unidad, generalesAsignados: null, despuesDeGenerales: null };
        const asignado = generales * (u.ingresos / ingresos);
        return { unidad: u.unidad, generalesAsignados: r2(asignado), despuesDeGenerales: r2(u.contribucion - asignado) };
      })
    : null;

  const parcial = Boolean(hoy) && String(hoy).slice(0, 7) === mes;
  const motivosConfianza = [];
  if (!baseConfirmada) motivosConfianza.push("Base de IVA de las ventas por confirmar.");
  if (!hayMovimientos) motivosConfianza.push("Sin movimientos de Tesorería.");
  if (g.sinClasificar.length) motivosConfianza.push("Hay movimientos sin clasificar.");
  if (g.pendientesRevision) motivosConfianza.push(`${g.pendientesRevision} movimiento(s) sin revisar.`);
  if (g.fueraDeResultados.impuestosSinTipo) motivosConfianza.push("Pagos al SAT sin indicar IVA o ISR.");
  if (tipoIsr === "ESTIMADO") motivosConfianza.push("ISR estimado con tasa, no calculado por el contador.");
  if (baseIntereses === "pagado_en_el_mes") motivosConfianza.push("Intereses en base pagado, no devengado.");
  if (parcial) motivosConfianza.push("Mes en curso: cifras parciales.");
  const incompleto = faltantes.length > 0;
  const confianza = !hayMovimientos || g.sinClasificar.length || !baseConfirmada || utilidadOperativa === null || (canalesSinDatos || []).length
    ? "baja"
    : incompleto || g.pendientesRevision || g.fueraDeResultados.impuestosSinTipo || tipoIsr === "ESTIMADO" || baseIntereses !== "devengado" || parcial
      ? "media"
      : "alta";

  return {
    calculable: utilidadBruta !== null || unidades.some((u) => u.utilidadBruta !== null),
    tipo: "ESTADO_DE_RESULTADOS",
    businessId,
    mes,
    parcial,
    unidades,
    consolidado: {
      ingresos: r2(ingresos),
      costoMercancia: r2(costoMercancia),
      utilidadBruta: r2(utilidadBruta),
      margenBrutoPct: r1(pct(utilidadBruta, ingresos)),
      gastosOperativos: gastosOperativos === null ? null : {
        total: r2(gastosOperativos),
        ventaCanales: r2(gastosVenta),
        directosSucursales: r2(directos),
        generales: r2(generales),
        generalesPorNaturaleza: redondearMapa(g.generales),
      },
      utilidadOperativa: r2(utilidadOperativa),
      margenOperativoPct: r1(pct(utilidadOperativa, ingresos)),
      intereses: r2(interesesMonto),
      utilidadAntesISR: r2(utilidadAntesISR),
      isr: r2(isrMonto),
      tipoIsr,
      utilidadNeta: r2(utilidadNeta),
      margenNetoPct: r1(pct(utilidadNeta, ingresos)),
    },
    noSonGasto: hayMovimientos ? redondearMapa(g.fueraDeResultados) : null,
    repartoGeneralesPorVentas: reparto && { tipo: "SUPUESTO", nota: "Reparto proporcional a ventas; solo como referencia.", unidades: reparto },
    excluidosPorDuplicado: g.excluidosPorDuplicado,
    sinClasificar: g.sinClasificar,
    bases: {
      ingresos: baseConfirmada ? "sin IVA" : "importe reportado (IVA por confirmar)",
      gastos: "pagado en el mes (Tesorería)",
      intereses: baseIntereses,
      costo: "costo SICAR (importe − utilidad del reporte)",
    },
    confianza,
    motivosConfianza,
    faltantes: [...new Set(faltantes)],
  };
}

const LINEAS_COMPARABLES = ["ingresos", "costoMercancia", "utilidadBruta", "utilidadOperativa", "intereses", "utilidadAntesISR", "isr", "utilidadNeta"];

function variacion(actual, anterior) {
  if (actual === null || anterior === null || actual === undefined || anterior === undefined) return { delta: null, pct: null };
  return { delta: r2(actual - anterior), pct: anterior === 0 ? null : r1(((actual - anterior) / Math.abs(anterior)) * 100) };
}

/*
 * Descompone el cambio de utilidad bruta en volumen y margen:
 *   ΔUB = (I₂ − I₁)·m₁  +  I₂·(m₂ − m₁)
 * La suma es exacta.
 */
export function efectoVolumenMargen(anterior, actual) {
  const i1 = anterior?.ingresos, i2 = actual?.ingresos, b1 = anterior?.utilidadBruta, b2 = actual?.utilidadBruta;
  if ([i1, i2, b1, b2].some((v) => v === null || v === undefined) || i1 === 0) return null;
  const m1 = b1 / i1;
  const m2 = i2 === 0 ? m1 : b2 / i2;
  return { volumen: r2((i2 - i1) * m1), margen: r2(i2 * (m2 - m1)), total: r2(b2 - b1) };
}

/*
 * Comparativo mensual de varios estados del mismo negocio (orden por mes).
 * Para cada mes: variación contra el mes anterior y contra el mismo mes
 * del año anterior si existe; para cada unidad, lo mismo. Un mes parcial
 * no se compara contra uno completo.
 */
export function compararMeses(estados = []) {
  const lista = [...(estados || [])].filter((e) => e?.mes).sort((a, b) => a.mes.localeCompare(b.mes));
  const negocios = new Set(lista.map((e) => String(e.businessId)));
  if (negocios.size > 1) return { calculable: false, faltantes: ["estados de un solo negocio"] };
  const porMes = new Map(lista.map((e) => [e.mes, e]));
  const anioAnterior = (mes) => `${Number(mes.slice(0, 4)) - 1}${mes.slice(4)}`;

  const meses = lista.map((estado, i) => {
    const previo = i > 0 ? lista[i - 1] : null;
    const comparable = previo && !estado.parcial && !previo.parcial;
    const contra = (otro) =>
      otro && !estado.parcial && !otro.parcial
        ? Object.fromEntries(LINEAS_COMPARABLES.map((l) => [l, variacion(estado.consolidado[l], otro.consolidado[l])]))
        : null;
    // Gastos operativos por naturaleza (directos + generales) y de canales.
    const gastosPorCategoria = (e) => {
      const acc = { ...(e.consolidado.gastosOperativos?.generalesPorNaturaleza || {}) };
      for (const u of e.unidades) {
        for (const [k, v] of Object.entries(u.gastosOperativosDirectos?.porNaturaleza || {})) acc[k] = (acc[k] || 0) + v;
      }
      if (e.consolidado.gastosOperativos?.ventaCanales != null) acc.venta_canales = e.consolidado.gastosOperativos.ventaCanales;
      return acc;
    };
    let gastos = null;
    if (comparable && estado.consolidado.gastosOperativos && previo.consolidado.gastosOperativos) {
      const a = gastosPorCategoria(estado), b = gastosPorCategoria(previo);
      gastos = Object.keys({ ...a, ...b }).map((k) => ({ categoria: k, actual: r2(a[k] ?? 0), anterior: r2(b[k] ?? 0), ...variacion(a[k] ?? 0, b[k] ?? 0) }))
        .sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0));
    }
    const unidades = estado.unidades.map((u) => {
      const p = comparable ? previo.unidades.find((x) => x.unidad === u.unidad) : null;
      return {
        unidad: u.unidad,
        nombre: u.nombre,
        tipo: u.tipo,
        ingresos: variacion(u.ingresos, p?.ingresos ?? null),
        utilidadBruta: variacion(u.utilidadBruta, p?.utilidadBruta ?? null),
        margenBrutoPp: u.margenBrutoPct === null || p?.margenBrutoPct == null ? null : r1(u.margenBrutoPct - p.margenBrutoPct),
        contribucion: variacion(u.contribucion, p?.contribucion ?? null),
        efecto: p ? efectoVolumenMargen(p, u) : null,
      };
    });
    return {
      mes: estado.mes,
      parcial: estado.parcial,
      confianza: estado.confianza,
      consolidado: estado.consolidado,
      vsMesAnterior: comparable ? contra(previo) : null,
      vsMismoMesAnioAnterior: contra(porMes.get(anioAnterior(estado.mes))),
      efectoUtilidadBruta: comparable ? efectoVolumenMargen(previo.consolidado, estado.consolidado) : null,
      margenBrutoPp: comparable && estado.consolidado.margenBrutoPct !== null && previo.consolidado.margenBrutoPct !== null
        ? r1(estado.consolidado.margenBrutoPct - previo.consolidado.margenBrutoPct) : null,
      gastos,
      unidades,
      noComparableMotivo: previo && !comparable ? "Uno de los dos meses está en curso (parcial)." : null,
    };
  });
  return { calculable: lista.length > 0, meses, estadosPorMes: Object.fromEntries(lista.map((e) => [e.mes, e])) };
}

/*
 * Recomendaciones para mejorar la rentabilidad, a partir del último mes
 * comparable. Cada una trae impacto mensual estimado (o null si no se
 * puede estimar), evidencia y la acción sugerida. Son SUGERENCIAS: nada se
 * ejecuta sin autorización (precios, campañas, publicaciones, pagos).
 */
export function recomendacionesRentabilidad(comparativo, { umbralGastoPct = 15, umbralGastoMonto = 1000, umbralMargenPp = 2, umbralCargosPct = 35, umbralCancelacionPct = 5 } = {}) {
  const meses = (comparativo?.meses || []).filter((m) => !m.parcial);
  const mes = meses.at(-1);
  if (!mes) return [];
  const recs = [];
  const agregar = (rec) => recs.push({ tipo: "RECOMENDACION", requiereAutorizacion: true, mes: mes.mes, confianza: mes.confianza, ...rec });

  // Cifras absolutas del mes (el comparativo solo trae variaciones).
  const estado = comparativo.estadosPorMes?.[mes.mes] || null;

  // 1. Unidades con contribución negativa y señales de cada canal.
  for (const u of estado?.unidades || []) {
    if (u.contribucion !== null && u.contribucion < 0) {
      agregar({
        clave: `contribucion_negativa:${u.unidad}`,
        titulo: `${u.nombre} pierde dinero antes de gastos generales`,
        impactoMensual: r2(-u.contribucion),
        evidencia: `Contribución de ${u.contribucion} con ingresos de ${u.ingresos}.`,
        accion: u.tipo === "canal"
          ? "Revisar precios contra el precio mínimo rentable y pausar publicaciones con pérdida (con tu autorización)."
          : "Revisar renta, nómina y horario de la sucursal; comparar con sus ventas por hora.",
      });
    }
    // 4. Publicaciones con pérdida.
    const perdedores = (u.indicadores?.productosConPerdida || []).filter((p) => p.utilidad !== null);
    if (perdedores.length) {
      agregar({
        clave: `productos_con_perdida:${u.unidad}`,
        titulo: `${perdedores.length} publicación(es) de ${u.nombre} venden con pérdida`,
        impactoMensual: r2(-perdedores.reduce((s, p) => s + p.utilidad, 0)),
        evidencia: perdedores.slice(0, 5).map((p) => `${p.titulo || p.sku}: ${p.utilidad}`).join("; "),
        accion: "Subir al precio mínimo rentable o pausar (no se cambia nada sin tu autorización).",
      });
    }
    if (u.indicadores?.cargosPct !== null && u.indicadores?.cargosPct > umbralCargosPct) {
      agregar({
        clave: `cargos_altos:${u.unidad}`,
        titulo: `Comisiones y envíos de ${u.nombre} se llevan ${u.indicadores.cargosPct}% de la venta`,
        impactoMensual: u.ingresos === null ? null : r2(u.ingresos * ((u.indicadores.cargosPct - umbralCargosPct) / 100)),
        evidencia: `Umbral de referencia ${umbralCargosPct}%.`,
        accion: "Revisar envío gratis en productos baratos, kits para subir el ticket y tipo de publicación.",
      });
    }
    if (u.indicadores?.tasaCancelacionPct !== null && u.indicadores?.tasaCancelacionPct > umbralCancelacionPct) {
      agregar({
        clave: `cancelaciones:${u.unidad}`,
        titulo: `${u.nombre} cancela ${u.indicadores.tasaCancelacionPct}% de las órdenes`,
        impactoMensual: null,
        evidencia: "Ver diagnóstico de cancelaciones por causa.",
        accion: "Atender primero las cancelaciones atribuibles al vendedor (stock, tiempos).",
      });
    }
  }

  // 2. Caída de margen bruto por unidad.
  for (const u of mes.unidades) {
    if (u.margenBrutoPp !== null && u.margenBrutoPp <= -umbralMargenPp && u.efecto) {
      agregar({
        clave: `margen_bruto:${u.unidad}`,
        titulo: `El margen bruto de ${u.nombre} bajó ${Math.abs(u.margenBrutoPp)} puntos`,
        impactoMensual: r2(-u.efecto.margen),
        evidencia: `Efecto margen ${u.efecto.margen}; efecto volumen ${u.efecto.volumen}.`,
        accion: "Revisar descuentos, mezcla de productos y costos de compra recientes.",
      });
    }
    if (u.ingresos.pct !== null && u.ingresos.pct <= -10 && (u.margenBrutoPp === null || u.margenBrutoPp > -umbralMargenPp) && u.efecto) {
      agregar({
        clave: `volumen:${u.unidad}`,
        titulo: `Las ventas de ${u.nombre} bajaron ${Math.abs(u.ingresos.pct)}% con margen estable`,
        impactoMensual: r2(-u.efecto.volumen),
        evidencia: `Efecto volumen ${u.efecto.volumen}.`,
        accion: "Problema de tráfico o surtido: revisar quiebres de inventario y campañas de la zona.",
      });
    }
  }

  // 3. Gastos que crecieron.
  for (const fila of mes.gastos || []) {
    if (fila.delta !== null && fila.delta >= umbralGastoMonto && (fila.pct === null || fila.pct >= umbralGastoPct)) {
      agregar({
        clave: `gasto:${fila.categoria}`,
        titulo: `El gasto de ${fila.categoria} subió ${fila.delta}`,
        impactoMensual: fila.delta,
        evidencia: `De ${fila.anterior} a ${fila.actual}${fila.pct === null ? "" : ` (${fila.pct}%)`}.`,
        accion: "Confirmar si es recurrente, extraordinario o un registro duplicado.",
      });
    }
  }

  // 5. Intereses que se comen la operación.
  const c = mes.consolidado;
  if (c.intereses !== null && c.utilidadOperativa !== null && c.utilidadOperativa > 0 && c.intereses / c.utilidadOperativa >= 0.3) {
    agregar({
      clave: "intereses",
      titulo: `Los intereses se llevan ${r1((c.intereses / c.utilidadOperativa) * 100)}% de la utilidad operativa`,
      impactoMensual: null,
      evidencia: `Intereses ${c.intereses}; utilidad operativa ${c.utilidadOperativa}.`,
      accion: "Abonar primero a la deuda de mayor tasa (ver simulador de pago de deuda).",
    });
  }

  // 6. Calidad del dato.
  if (estado?.sinClasificar?.length) {
    agregar({
      clave: "clasificar",
      titulo: `${estado.sinClasificar.length} movimiento(s) de Tesorería sin clasificar`,
      impactoMensual: null,
      evidencia: "Mientras no se clasifiquen, la utilidad puede estar sobrestimada.",
      accion: "Clasificar en Tesorería (gasto fijo/variable, impuesto, deuda, retiro…).",
    });
  }
  return recs.sort((a, b) => (b.impactoMensual ?? -1) - (a.impactoMensual ?? -1));
}

/* Comparativo + recomendaciones en una sola llamada. */
export function analizarRentabilidad(estados = [], opciones = {}) {
  const comparativo = compararMeses(estados);
  return { comparativo, recomendaciones: recomendacionesRentabilidad(comparativo, opciones) };
}
