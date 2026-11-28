/*
 * ESTADO DE RESULTADOS MENSUAL POR SUCURSAL Y CANAL · MONYS OS
 *
 * Un negocio por estado (Monys Glam; flotilla en el suyo).
 *
 *   Ingresos
 * − Costo de mercancía (SICAR)
 * = Utilidad bruta
 * − Gastos de venta del canal (comisiones, envíos, publicidad)
 * − Gastos operativos directos (sucursal o canal)
 * = Contribución de la unidad
 * − Gastos generales (sin sucursal; no se reparten)
 * = Utilidad operativa
 * − Intereses
 * = Utilidad antes de ISR
 * − ISR
 * = Utilidad neta
 *
 * Reglas (revisión de ChatGPT/Codex en #171):
 * - Dato faltante ≠ 0. Cada renglón conocido se conserva aunque falte el
 *   siguiente (ingresos sin utilidad, sucursal sin gastos…).
 * - Cobertura real por día: una carga de SICAR cubre los días de su
 *   periodo; un día sin cobertura es faltante; un día cubierto sin ventas
 *   es cero real. Una carga más nueva reemplaza un día solo si lo cubre
 *   completo.
 * - Disponibilidad de importe y utilidad por separado; bandera null
 *   (historial) con valor 0 = desconocido.
 * - Gastos en tres bases: pagado (Tesorería registrada, provisional: una
 *   lista vacía no prueba cero), devengado (obligaciones del motor de
 *   equilibrio; sin obligación, lo pagado) y pendiente (vence − pagado).
 * - Bases de IVA independientes: ventas, costo SICAR, cargos de cada
 *   canal y gastos de Tesorería. Por confirmar = importe tal como viene,
 *   marcado como provisional. Nunca se deduce una base de otra.
 * - Plataformas en Tesorería (cash_movement_platform_links): solo se
 *   excluye la parte verificada y ligada a una operación del periodo ya
 *   restada en las órdenes; el resto es cargo distinto y queda por
 *   conciliar. Los depósitos de plataformas (entradas) nunca son ingreso:
 *   el ingreso sale de las órdenes.
 * - Calendario operativo: fuera de vigencia no se esperan ventas; un día
 *   cerrado confirmado cuenta como cubierto con cero; un cierre no
 *   elimina gastos.
 * - Alcance de la carga SICAR: una carga marcada como filtrada no prueba
 *   que un día sin renglones tuvo venta cero.
 * - Subtotal conocido siempre; consolidado solo si está completo.
 * Módulo puro: sin Supabase ni React.
 */
import { clasificarMovimiento, NATURALEZAS } from "./conciliacionGastos.js";
import { gastosFijosDelMes } from "./equilibrioReal.js";
import { conciliarMovimientoPlataforma } from "./conciliacionPlataformas.js";

const r2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
const r1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
const texto = (v) => String(v ?? "").trim().toLowerCase();

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

const vacio = (v) => v === null || v === undefined;
const restar = (a, ...bs) => (vacio(a) || bs.some(vacio) ? null : a - bs.reduce((s, b) => s + b, 0));
const sumarTodos = (vs) => (!vs.length ? 0 : vs.every((v) => !vacio(v)) ? vs.reduce((s, v) => s + v, 0) : null);
const pct = (parte, total) => (vacio(parte) || vacio(total) || total === 0 ? null : (parte / total) * 100);

export const BASES_IVA = Object.freeze({ SIN_IVA: "sin_iva", CON_IVA: "con_iva", POR_CONFIRMAR: "por_confirmar" });
const DIA = 86400000;

export function mesLocal(fecha) {
  const valor = String(fecha ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.slice(0, 7);
  const p = new Date(valor);
  if (Number.isNaN(p.getTime())) return null;
  return new Date(p.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 7);
}

function diaLocal(fecha) {
  const valor = String(fecha ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  if (/^\d{4}-\d{2}-\d{2} /.test(valor)) return valor.slice(0, 10);
  const p = new Date(valor);
  if (Number.isNaN(p.getTime())) return null;
  return new Date(p.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}

const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);

/* Días del mes que deben tener dato: hasta ayer si es el mes en curso. */
export function diasEsperados(mes, hoy = null) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const limite = hoy && String(hoy).slice(0, 7) === mes ? sumarDias(String(hoy).slice(0, 10), -1) : ultimo;
  const dias = [];
  for (let d = `${mes}-01`; d <= limite && d <= ultimo; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

export function leerBase(baseIva = {}) {
  const base = Object.values(BASES_IVA).includes(baseIva?.base) ? baseIva.base : BASES_IVA.POR_CONFIRMAR;
  const ivaPct = numero(baseIva?.ivaPct);
  const valida = ivaPct !== null && ivaPct >= 0 && ivaPct < 100 ? ivaPct : null;
  return { base: base === BASES_IVA.CON_IVA && valida === null ? BASES_IVA.POR_CONFIRMAR : base, ivaPct: valida };
}

function quitarIva(importe, base) {
  if (vacio(importe)) return null;
  return base.base === BASES_IVA.CON_IVA ? importe / (1 + base.ivaPct / 100) : importe;
}

/* ───────────── SICAR: cobertura y disponibilidad ───────────── */

/*
 * true = dato; false = no venía; null (historial) = dato si es distinto de
 * cero, desconocido si es 0 (un 0 histórico puede ser celda vacía).
 */
function disponible(valor, bandera) {
  const n = numero(valor);
  if (bandera === false || n === null) return { valor: null, sinBandera: false };
  if (bandera === true) return { valor: n, sinBandera: false };
  return { valor: n === 0 ? null : n, sinBandera: true };
}

/*
 * Alcance de una carga: días que cubre completos y días parciales. Un
 * periodo que termina el día en que se hizo la carga deja ese día parcial
 * (el reporte se sacó antes de cerrar). Sin periodo declarado, el alcance
 * se infiere de las filas y ningún día queda confirmado.
 */
function alcanceDeCarga(carga, diasConFilas) {
  const inicio = diaLocal(carga.periodoInicio);
  const fin = diaLocal(carga.periodoFin);
  const creado = diaLocal(carga.created_at);
  if (!inicio || !fin || fin < inicio) return { completos: new Set(), parciales: new Set(diasConFilas), inferido: true };
  const completos = new Set();
  const parciales = new Set();
  // Un reporte con filtros (departamento, vendedor…) no cubre el día completo.
  const filtrada = carga.alcance === "filtrado";
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) {
    if (filtrada || (d === fin && creado && creado <= fin)) parciales.add(d);
    else completos.add(d);
  }
  return { completos, parciales, inferido: false };
}

/*
 * Por sucursal y día, qué carga cuenta. Gana la más reciente que cubre
 * el día completo; una carga parcial más nueva NO reemplaza a una
 * completa. Si solo hay parciales, la más reciente y el día queda parcial.
 * Dos cargas completas del mismo día con totales distintos = conflicto.
 * importaciones: [{ id, branch_id, created_at, periodoInicio, periodoFin, alcance }]
 *   alcance: "completo" | "filtrado" | null (desconocido, cargas anteriores).
 */
export function elegirCargasPorDia(filas = [], importaciones = []) {
  const cargas = new Map((importaciones || []).map((c) => [String(c.id), c]));
  const filasPorCarga = new Map();
  for (const fila of filas || []) {
    const id = String(fila?.importacion_id);
    if (!cargas.has(id)) continue;
    if (!filasPorCarga.has(id)) filasPorCarga.set(id, []);
    filasPorCarga.get(id).push(fila);
  }
  const ordenadas = [...cargas.values()].sort(
    (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id))
  );
  const alcance = new Map(
    ordenadas.map((c) => {
      const dias = new Set((filasPorCarga.get(String(c.id)) || []).map((f) => diaLocal(f.fecha)).filter(Boolean));
      return [String(c.id), alcanceDeCarga(c, dias)];
    })
  );
  const totalDia = (carga, dia) =>
    (filasPorCarga.get(String(carga.id)) || []).filter((f) => diaLocal(f.fecha) === dia).reduce((s, f) => s + (numero(f.importe) || 0), 0);

  const claves = new Set();
  for (const c of ordenadas) {
    const a = alcance.get(String(c.id));
    for (const d of [...a.completos, ...a.parciales]) claves.add(`${c.branch_id}|${d}`);
  }
  const dias = new Map();
  const ganadora = new Map();
  for (const clave of claves) {
    const [branch, dia] = clave.split("|");
    const deLaSucursal = ordenadas.filter((c) => String(c.branch_id) === branch);
    const completas = deLaSucursal.filter((c) => alcance.get(String(c.id)).completos.has(dia));
    const parciales = deLaSucursal.filter((c) => alcance.get(String(c.id)).parciales.has(dia));
    if (completas.length) {
      const elegida = completas[0];
      const conflicto = completas.slice(1).some((otra) => Math.abs(totalDia(otra, dia) - totalDia(elegida, dia)) > 0.005);
      ganadora.set(clave, String(elegida.id));
      dias.set(clave, conflicto ? "conflicto" : "completo");
    } else if (parciales.length) {
      ganadora.set(clave, String(parciales[0].id));
      dias.set(clave, alcance.get(String(parciales[0].id)).inferido ? "sin_confirmar" : "parcial");
    }
  }
  const elegidas = [];
  let descartadas = 0;
  for (const fila of filas || []) {
    const carga = cargas.get(String(fila?.importacion_id));
    const dia = diaLocal(fila?.fecha);
    if (!carga || !dia || ganadora.get(`${carga.branch_id}|${dia}`) !== String(carga.id)) {
      descartadas += 1;
      continue;
    }
    elegidas.push({ ...fila, branch_id: carga.branch_id, dia });
  }
  const cargasFiltradas = ordenadas.filter((c) => c.alcance === "filtrado").map((c) => ({ id: c.id, branch_id: c.branch_id, periodoInicio: c.periodoInicio, periodoFin: c.periodoFin }));
  return { filas: elegidas, dias, descartadas, cargasFiltradas };
}

/* Ventas de una sucursal en un mes, con su cobertura. */
export function ventasSucursalDelMes({ branchId, mes, filas = [], dias = new Map(), diasCerrados = [], diasFueraDeVigencia = [], hoy = null }) {
  const fuera = new Set(diasFueraDeVigencia || []);
  const esperados = diasEsperados(mes, hoy).filter((d) => !fuera.has(d));
  const cerrados = new Set(diasCerrados || []);
  const conteo = { completo: 0, parcial: 0, sin_confirmar: 0, conflicto: 0, cerrado: 0, sin_dato: 0 };
  const sinDato = [];
  for (const d of esperados) {
    const estado = cerrados.has(d) ? "cerrado" : dias.get(`${branchId}|${d}`) || "sin_dato";
    conteo[estado] += 1;
    if (estado === "sin_dato") sinDato.push(d);
  }
  let importe = 0, costo = 0, sinImporte = 0, sinUtilidad = 0, sinBandera = 0, renglones = 0;
  for (const f of filas) {
    if (String(f.branch_id) !== String(branchId) || !String(f.dia).startsWith(mes)) continue;
    renglones += 1;
    const i = disponible(f.importe, f.importe_disponible ?? null);
    const u = disponible(f.utilidad, f.utilidad_disponible ?? null);
    if (i.sinBandera || u.sinBandera) sinBandera += 1;
    if (i.valor === null) sinImporte += 1;
    else importe += i.valor;
    if (i.valor === null || u.valor === null) sinUtilidad += 1;
    else costo += i.valor - u.valor;
  }
  return {
    branchId: String(branchId),
    mes,
    ingresosRegistrados: r2(importe),
    ingresos: sinImporte ? null : r2(importe),
    costoMercancia: sinUtilidad ? null : r2(costo),
    renglones,
    renglonesSinImporte: sinImporte,
    renglonesSinUtilidad: sinUtilidad,
    renglonesSinBandera: sinBandera,
    cobertura: {
      diasEsperados: esperados.length,
      ...conteo,
      completa: esperados.length > 0 && conteo.completo + conteo.cerrado === esperados.length,
      diasSinDato: sinDato,
    },
  };
}

/* ───────────── Canales ───────────── */

function unidadDeCanal(entrada, basesUsadas) {
  const r = entrada?.resumen || {};
  const faltantes = [];
  const ventasBase = leerBase(entrada?.baseIvaVentas);
  const cargosBase = leerBase(entrada?.baseIvaCargos);
  const ventas = numero(r.ventasPagadas);
  const costos = (r.porSku || []).map((f) => numero(f?.costoProducto));
  const costoMercancia = costos.length ? sumarTodos(costos) : ventas === 0 ? 0 : null;
  const comisiones = numero(r.comisiones);
  const envios = numero(r.envios);
  const ads = numero(entrada?.publicidad);
  const canal = r.canal;
  if (costoMercancia === null) faltantes.push(`${canal}: costo SICAR de publicaciones sin vincular`);
  if (comisiones === null) faltantes.push(`${canal}: comisiones`);
  if (envios === null) faltantes.push(`${canal}: costo de envíos`);
  if (ads === null) faltantes.push(`${canal}: gasto de publicidad del mes`);
  if (entrada?.coberturaCompleta !== true) faltantes.push(`${canal}: la sincronización del mes no está completa`);
  basesUsadas[`ventas_${canal}`] = ventasBase.base;
  basesUsadas[`cargos_${canal}`] = cargosBase.base;
  const completa = entrada?.coberturaCompleta === true;
  return {
    unidad: `canal:${entrada?.cuentaId}`,
    nombre: canal === "mercado_libre" ? "Mercado Libre" : canal === "tiktok_shop" ? "TikTok Shop" : String(canal),
    tipo: "canal",
    canal,
    cuentaId: String(entrada?.cuentaId),
    cuentaExterna: entrada?.cuentaExterna ?? null,
    operaciones: new Set((entrada?.operaciones || []).map(String)),
    ingresosRegistrados: quitarIva(ventas, ventasBase),
    ingresos: completa ? quitarIva(ventas, ventasBase) : null,
    costoMercancia: completa ? costoMercancia : null,
    gastosVentaBase: { comisiones: quitarIva(comisiones, cargosBase), envios: quitarIva(envios, cargosBase), publicidad: quitarIva(ads, cargosBase) },
    cobertura: { completa },
    indicadores: {
      tasaCancelacionPct: numero(r.tasaCancelacionPct),
      cargosPct: numero(r.cargosPct),
      productosConPerdida: (r.productosConPerdida || []).map((p) => ({ sku: p.sku, publicacion: p.publicacion, titulo: p.titulo, utilidad: numero(p.utilidad), unidades: p.unidades })),
    },
    faltantes,
  };
}

/* ───────────── Tesorería ───────────── */

const CATEGORIA_OBLIGACION = { renta: "RENTA", nomina: "NOMINA", cuotas_imss_infonavit: "NOMINA", servicios: "SERVICIOS", seguros: "SEGUROS" };

function clasificarGastos(movimientos, mes, canales, baseGastos, vinculos, businessId) {
  const pagado = { generales: {}, porUnidad: {} };
  const fuera = { iva: 0, isrPagado: 0, impuestosSinTipo: 0, capitalDeuda: 0, compraInventario: 0, retiros: 0, financiamiento: 0, traspasos: 0 };
  let intereses = 0;
  const sinClasificar = [];
  const excluidosPorDuplicado = [];
  const cargosPorConciliar = [];
  let pendientesRevision = 0;
  const sumar = (destino, categoria, importe) => { destino[categoria] = (destino[categoria] || 0) + importe; };

  for (const mov of movimientos || []) {
    if (texto(mov?.status) === "cancelado") continue;
    if (mesLocal(mov?.occurred_at) !== mes) continue;
    if (texto(mov?.movement_type ?? mov?.tipo) !== "salida") continue;
    const bruto = numero(mov?.amount);
    if (bruto === null || bruto <= 0) {
      sinClasificar.push({ id: mov?.id, motivo: "Importe inválido." });
      continue;
    }
    if (texto(mov?.status) !== "revisado") pendientesRevision += 1;
    const categoriaTesoreria = texto(mov?.expense_category);
    // Parte ya contada en las órdenes del canal (vínculo verificado).
    const propios = (vinculos || []).filter((v) => String(v?.cash_movement_id) === String(mov?.id));
    const c = propios.length || categoriaTesoreria === "comisiones_marketplace"
      ? conciliarMovimientoPlataforma(mov, propios, canales, { businessId })
      : null;
    if (c?.excluido) excluidosPorDuplicado.push({ id: mov?.id, importe: r2(quitarIva(c.excluido, baseGastos)), detalle: c.detalle.filter((d) => d.excluido) });
    const restanteBruto = c ? c.restante : bruto;
    if (restanteBruto <= 0) continue;
    const importe = quitarIva(restanteBruto, baseGastos);
    if (c) {
      cargosPorConciliar.push({
        id: mov?.id, importe: r2(importe), estado: vinculos === null ? "conciliacion_no_disponible" : c.estado,
        motivos: [...new Set(c.detalle.filter((d) => d.motivo).map((d) => d.motivo))],
      });
    }
    if (categoriaTesoreria === "comisiones_marketplace") {
      const unidad = c?.cuentaDelRestante ? canales.find((u) => u.cuentaId === String(c.cuentaDelRestante)) : null;
      sumar(unidad ? (pagado.porUnidad[unidad.unidad] ||= {}) : pagado.generales, "CARGOS_MARKETPLACE", importe);
      continue;
    }
    const { naturaleza, esGasto, motivo } = clasificarMovimiento(mov);
    if (esGasto) {
      const categoria = CATEGORIA_OBLIGACION[categoriaTesoreria] || categoriaTesoreria.toUpperCase() || "OTRO";
      sumar(mov?.branch_id ? (pagado.porUnidad[String(mov.branch_id)] ||= {}) : pagado.generales, categoria, importe);
      continue;
    }
    switch (naturaleza) {
      case NATURALEZAS.INTERESES: intereses += bruto; break;
      case NATURALEZAS.IMPUESTO_IVA: fuera.iva += bruto; break;
      case NATURALEZAS.IMPUESTO_ISR: fuera.isrPagado += bruto; break;
      case NATURALEZAS.IMPUESTOS: fuera.impuestosSinTipo += bruto; break;
      case NATURALEZAS.CAPITAL_DEUDA: fuera.capitalDeuda += bruto; break;
      case NATURALEZAS.COMPRA_INVENTARIO: fuera.compraInventario += bruto; break;
      case NATURALEZAS.RETIRO_PROPIETARIA: fuera.retiros += bruto; break;
      case NATURALEZAS.FINANCIAMIENTO: fuera.financiamiento += bruto; break;
      case NATURALEZAS.TRASPASO: fuera.traspasos += bruto; break;
      case NATURALEZAS.AJUSTE: break;
      default: sinClasificar.push({ id: mov?.id, concepto: mov?.concept || "", importe: bruto, motivo: motivo || "Sin clasificar." });
    }
  }
  return { pagado, fuera, intereses, sinClasificar, excluidosPorDuplicado, cargosPorConciliar, pendientesRevision };
}

/*
 * Gastos en tres bases reutilizando el motor de equilibrio
 * (gastosFijosDelMes): devengado = obligación mensual si existe, si no lo
 * pagado; pendiente = vence − pagado. Impuestos no son gasto operativo.
 * Obligaciones "OTRO" no se pueden cruzar con Tesorería: aparte.
 */
function gastosEnTresBases(pagadoPorCategoria, obligaciones, mes) {
  const operativas = (obligaciones || []).filter((o) => String(o?.categoria || "").toUpperCase() !== "IMPUESTOS");
  const fijos = gastosFijosDelMes(operativas, mes);
  const categorias = new Set([...Object.keys(pagadoPorCategoria), ...Object.keys(fijos.porCategoria)]);
  const filas = [];
  const sinCruzar = [];
  let pagado = 0, devengado = 0, pendiente = 0;
  for (const categoria of [...categorias].sort()) {
    const p = pagadoPorCategoria[categoria] || 0;
    const obligacion = fijos.porCategoria[categoria];
    const vence = fijos.vencePorCategoria[categoria];
    if (categoria === "OTRO" && obligacion !== undefined) {
      sinCruzar.push({ categoria, devengadoObligacion: r2(obligacion), vence: r2(vence) });
      if (p) {
        pagado += p;
        devengado += p;
        filas.push({ categoria, pagado: r2(p), devengado: r2(p), vence: null, pendiente: null, fuente: "pagado" });
      }
      continue;
    }
    const d = obligacion !== undefined ? obligacion : p;
    const pend = vence !== undefined ? Math.max(0, vence - p) : null;
    pagado += p;
    devengado += d;
    if (pend) pendiente += pend;
    filas.push({ categoria, pagado: r2(p), devengado: r2(d), vence: vence === undefined ? null : r2(vence), pendiente: pend === null ? null : r2(pend), fuente: obligacion !== undefined ? "obligacion" : "pagado" });
  }
  return { pagado: r2(pagado), devengado: r2(devengado), pendiente: r2(pendiente), porCategoria: filas, obligacionesSinCruzar: sinCruzar };
}

/* ───────────── Estado del mes ───────────── */

const LINEAS = ["ingresosRegistrados", "ingresos", "costoMercancia", "utilidadBruta", "gastosVentaTotal", "gastosDirectosPagado", "gastosDirectosDevengado", "contribucionPagado", "contribucionDevengado"];

function lineasDeUnidad(u, gastos) {
  const utilidadBruta = restar(u.ingresos, u.costoMercancia);
  const gv = u.gastosVentaBase || null;
  const gastosVenta = gv ? sumarTodos([gv.comisiones, gv.envios, gv.publicidad]) : 0;
  const directosPagado = gastos ? gastos.pagado : null;
  const directosDevengado = gastos ? gastos.devengado : null;
  // Venta por día con venta esperada: días cubiertos y abiertos (un cierre
  // confirmado no diluye el promedio).
  const dias = u.cobertura ? u.cobertura.completo || 0 : 0;
  return {
    unidad: u.unidad,
    nombre: u.nombre || u.unidad,
    tipo: u.tipo,
    activa: u.activa ?? true,
    cobertura: u.cobertura,
    calendario: u.calendario ?? null,
    ingresosRegistrados: r2(u.ingresosRegistrados),
    ingresos: r2(u.ingresos),
    costoMercancia: r2(u.costoMercancia),
    utilidadBruta: r2(utilidadBruta),
    margenBrutoPct: r1(pct(utilidadBruta, u.ingresos)),
    gastosVenta: gv ? { comisiones: r2(gv.comisiones), envios: r2(gv.envios), publicidad: r2(gv.publicidad), total: r2(gastosVenta) } : null,
    gastosVentaTotal: r2(gastosVenta),
    gastosDirectos: gastos,
    gastosDirectosPagado: directosPagado,
    gastosDirectosDevengado: directosDevengado,
    contribucionPagado: r2(restar(utilidadBruta, gastosVenta, directosPagado)),
    contribucionDevengado: r2(restar(utilidadBruta, gastosVenta, directosDevengado)),
    ventaPromedioDiaria: u.tipo === "sucursal" && u.ingresos !== null && dias > 0 ? r2(u.ingresos / dias) : null,
    indicadores: u.indicadores || null,
  };
}

function subtotal(unidades, campo) {
  const conocidas = unidades.filter((u) => !vacio(u[campo]));
  return {
    valor: r2(conocidas.reduce((s, u) => s + u[campo], 0)),
    incluye: conocidas.map((u) => u.unidad),
    faltan: unidades.filter((u) => vacio(u[campo])).map((u) => u.unidad),
  };
}

/*
 * sucursales:   [{ id, name, active }] del negocio, incluidas inactivas.
 * sicar:        { filas, dias } de elegirCargasPorDia.
 * diasCerrados: { [branchId]: ["YYYY-MM-DD"] } confirmados.
 * canales:      [{ cuentaId, cuentaExterna, resumen, publicidad, operaciones,
 *                  coberturaCompleta, baseIvaVentas, baseIvaCargos }]
 * canalesConfigurados: [{ id, canal, cuenta_externa }] de canal_cuentas del
 *                  negocio, o null si no se pudo leer la configuración.
 * calendario:   { [branchId]: calendarioDelMes } del calendario operativo, o
 *                null si no está disponible.
 * vinculosPlataforma: filas de cash_movement_platform_links o null si la
 *                conciliación no está disponible.
 * movimientos:  líneas de Tesorería del negocio (lineasDelNegocio) o null.
 * obligaciones: obligaciones operativas del negocio (con branch_id o sin él).
 * bases:        { ventasSicar, costoSicar, gastosTesoreria } ({ base, ivaPct }).
 * intereses:    { devengadosEstimados } del motor de deudas, opcional.
 * isr:          { montoDelContador } o { tasaEstimadaPct }.
 */
export function construirEstadoResultados({
  businessId,
  mes,
  sucursales = [],
  sicar = { filas: [], dias: new Map() },
  diasCerrados = {},
  canales = [],
  canalesConfigurados = null,
  calendario = null,
  vinculosPlataforma = null,
  movimientos = null,
  obligaciones = [],
  bases = {},
  intereses = {},
  isr = {},
  hoy = null,
} = {}) {
  if (!businessId) return { calculable: false, faltantes: ["negocio"] };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ""))) return { calculable: false, faltantes: ["mes válido (YYYY-MM)"] };

  const faltantes = [];
  const provisional = [];
  const baseVentas = leerBase(bases.ventasSicar);
  const baseCosto = leerBase(bases.costoSicar);
  const baseGastos = leerBase(bases.gastosTesoreria);
  const basesUsadas = { ventasSicar: baseVentas.base, costoSicar: baseCosto.base, gastosTesoreria: baseGastos.base };

  // Sucursales: todas las del negocio; una inactiva sin nada en el mes no
  // opera; con calendario, la vigencia decide qué días se esperan.
  if (calendario === null) provisional.push("Calendario operativo no disponible: un día sin carga cuenta como faltante, no como cierre.");
  const noOperan = [];
  const unidadesSucursal = (sucursales || [])
    .map((s) => {
      const cal = calendario?.[s.id] || null;
      if (cal?.vigencia === "no_opera") {
        noOperan.push({ unidad: String(s.id), nombre: s.name, motivo: "fuera de su vigencia operativa" });
        return null;
      }
      if (cal?.vigencia === "desconocida") provisional.push(`${s.name}: sin vigencia registrada en el calendario operativo`);
      const v = ventasSucursalDelMes({
        branchId: s.id, mes, filas: sicar.filas, dias: sicar.dias, hoy,
        diasCerrados: cal ? cal.diasCerrados : diasCerrados?.[s.id] || [],
        diasFueraDeVigencia: cal ? cal.diasFueraDeVigencia : [],
      });
      const c = v.cobertura;
      if (s.active === false && !cal && !v.renglones && !c.completo && !c.parcial && !c.sin_confirmar && !c.cerrado) return null;
      const filtradas = (sicar.cargasFiltradas || []).filter((x) => String(x.branch_id) === String(s.id) && String(x.periodoFin).slice(0, 7) >= mes && String(x.periodoInicio).slice(0, 7) <= mes);
      if (filtradas.length) faltantes.push(`${s.name}: ${filtradas.length} carga(s) de SICAR con filtros: sus días no prueban venta cero`);
      if (c.sin_dato) faltantes.push(`${s.name}: ${c.sin_dato} día(s) sin carga de SICAR`);
      if (c.parcial || c.sin_confirmar) faltantes.push(`${s.name}: ${c.parcial + c.sin_confirmar} día(s) con carga parcial o sin periodo declarado`);
      if (c.conflicto) faltantes.push(`${s.name}: ${c.conflicto} día(s) con cargas que no coinciden`);
      if (v.renglonesSinImporte) faltantes.push(`${s.name}: ${v.renglonesSinImporte} renglón(es) sin importe`);
      if (v.renglonesSinUtilidad) faltantes.push(`${s.name}: ${v.renglonesSinUtilidad} renglón(es) sin utilidad`);
      if (v.renglonesSinBandera) provisional.push(`${s.name}: ${v.renglonesSinBandera} renglón(es) históricos sin bandera de disponibilidad`);
      const completa = c.completa && !c.conflicto;
      return {
        unidad: String(s.id),
        nombre: s.name,
        tipo: "sucursal",
        activa: s.active !== false,
        cobertura: c,
        calendario: cal ? { vigencia: cal.vigencia, diasCerrados: cal.diasCerrados.length, diasReducidos: cal.diasReducidos.length, diasSinRegistro: cal.diasSinRegistro.length, diasConVentaEsperada: cal.diasConVentaEsperada.length } : null,
        ingresosRegistrados: quitarIva(v.ingresosRegistrados, baseVentas),
        // Con cobertura incompleta no se conoce el ingreso del mes: se
        // conserva lo registrado aparte.
        ingresos: completa ? quitarIva(v.ingresos, baseVentas) : null,
        costoMercancia: completa ? quitarIva(v.costoMercancia, baseCosto) : null,
      };
    })
    .filter(Boolean);

  // Canales: solo cuentas configuradas para este negocio.
  const configuradas = canalesConfigurados === null ? null : new Map(canalesConfigurados.map((c) => [String(c.id), c]));
  if (configuradas === null) faltantes.push("configuración de canales no disponible: no se puede confirmar qué canales tiene el negocio");
  const canalesDescartados = [];
  const unidadesCanal = (canales || [])
    .filter((c) => {
      const ok = configuradas?.has(String(c?.cuentaId)) && configuradas.get(String(c.cuentaId)).canal === c?.resumen?.canal;
      if (!ok) canalesDescartados.push({ cuentaId: c?.cuentaId ?? null, motivo: "Cuenta de canal no configurada para este negocio." });
      return ok;
    })
    .map((c) => unidadDeCanal(c, basesUsadas));
  unidadesCanal.forEach((u) => faltantes.push(...u.faltantes));
  for (const [id, c] of configuradas || []) {
    if (!unidadesCanal.some((u) => u.cuentaId === id)) faltantes.push(`${c.canal}: sin datos del mes (cuenta ${c.cuenta_externa ?? id})`);
  }

  // Tesorería: lo registrado; una lista vacía no prueba que no hubo gastos.
  const hayTesoreria = Array.isArray(movimientos);
  if (!hayTesoreria) faltantes.push("movimientos de Tesorería del mes");
  else provisional.push("Gastos pagados según lo registrado en Tesorería; el mes no está confirmado como completo.");
  if (vinculosPlataforma === null) provisional.push("Conciliación de plataformas no disponible: ningún cargo de plataforma en Tesorería se excluye.");
  const g = clasificarGastos(movimientos || [], mes, unidadesCanal, baseGastos, vinculosPlataforma, businessId);
  if (g.sinClasificar.length) faltantes.push(`${g.sinClasificar.length} movimiento(s) de Tesorería sin clasificar`);
  if (g.cargosPorConciliar.length) provisional.push(`${g.cargosPorConciliar.length} cargo(s) de marketplace en Tesorería sin ligar a una operación: se restan como cargo distinto.`);
  const ids = new Set([...unidadesSucursal.map((u) => u.unidad), ...unidadesCanal.map((u) => u.unidad)]);
  const ajenos = Object.keys(g.pagado.porUnidad).filter((id) => !ids.has(id));
  if (ajenos.length) faltantes.push(`gastos de ${ajenos.length} sucursal(es) que no pertenecen al negocio o no operan en el mes`);

  const obligacionesDe = (branchId) =>
    (obligaciones || []).filter((o) => String(o?.business_id ?? businessId) === String(businessId) && (branchId === null ? !o?.branch_id : String(o?.branch_id) === String(branchId)));
  const unidades = [
    ...unidadesSucursal.map((u) => lineasDeUnidad(u, hayTesoreria ? gastosEnTresBases(g.pagado.porUnidad[u.unidad] || {}, obligacionesDe(u.unidad), mes) : null)),
    ...unidadesCanal.map((u) => lineasDeUnidad(u, hayTesoreria ? gastosEnTresBases(g.pagado.porUnidad[u.unidad] || {}, [], mes) : null)),
  ];
  const generales = hayTesoreria ? gastosEnTresBases(g.pagado.generales, obligacionesDe(null), mes) : null;
  const fijos = gastosFijosDelMes(obligacionesDe(null).concat(...unidadesSucursal.map((u) => obligacionesDe(u.unidad))), mes);
  if (!fijos.completo) faltantes.push(...fijos.faltantes.map((f) => `obligaciones: ${f}`));

  // Subtotales conocidos (siempre) y consolidado (solo si está completo).
  const subtotales = Object.fromEntries(LINEAS.map((l) => [l, subtotal(unidades, l)]));
  const canalesCompletos = configuradas !== null && unidadesCanal.length === configuradas.size;
  const total = (campo) => (unidades.length && !subtotales[campo].faltan.length && canalesCompletos ? subtotales[campo].valor : null);

  const ingresos = total("ingresos");
  const utilidadBruta = total("utilidadBruta");
  const operativaPagado = restar(total("contribucionPagado"), generales?.pagado ?? null);
  const operativaDevengado = restar(total("contribucionDevengado"), generales?.devengado ?? null);

  const interesesEstimados = numero(intereses?.devengadosEstimados);
  const interesesMonto = interesesEstimados ?? (hayTesoreria ? g.intereses : null);
  const baseIntereses = interesesEstimados !== null ? "devengado_estimado" : hayTesoreria ? "pagado_registrado" : null;
  if (interesesMonto === null) faltantes.push("intereses del mes");

  const utilidadOperativa = operativaDevengado ?? operativaPagado;
  const utilidadAntesISR = restar(utilidadOperativa, interesesMonto);
  const basesPorConfirmar = Object.entries(basesUsadas).filter(([, b]) => b === BASES_IVA.POR_CONFIRMAR).map(([k]) => k);
  if (basesPorConfirmar.length) provisional.push(`Bases de IVA por confirmar (${basesPorConfirmar.join(", ")}): importes tal como vienen.`);

  let isrMonto = null;
  let tipoIsr = null;
  const isrContador = numero(isr?.montoDelContador);
  const tasa = numero(isr?.tasaEstimadaPct);
  if (isrContador !== null) {
    isrMonto = isrContador;
    tipoIsr = "DEL_CONTADOR";
  } else if (tasa !== null && tasa >= 0 && tasa < 100 && utilidadAntesISR !== null) {
    isrMonto = Math.max(0, utilidadAntesISR) * (tasa / 100);
    tipoIsr = basesPorConfirmar.length ? "ESTIMADO_PROVISIONAL" : "ESTIMADO";
  } else faltantes.push("ISR del mes (monto del contador o tasa para estimarlo)");
  const utilidadNeta = isrMonto === null ? null : restar(utilidadAntesISR, isrMonto);

  const parcial = Boolean(hoy) && String(hoy).slice(0, 7) === mes;
  if (parcial) provisional.push("Mes en curso.");
  const confianza =
    !hayTesoreria || g.sinClasificar.length || utilidadOperativa === null || configuradas === null
      ? "baja"
      : faltantes.length || provisional.length || g.pendientesRevision
        ? "media"
        : "alta";
  const plano = (b) => b && { pagado: b.pagado, devengado: b.devengado, pendiente: b.pendiente, porCategoria: b.porCategoria, obligacionesSinCruzar: b.obligacionesSinCruzar };

  return {
    calculable: unidades.some((u) => u.ingresosRegistrados !== null),
    tipo: "ESTADO_DE_RESULTADOS",
    businessId,
    mes,
    parcial,
    unidades: unidades.map((u) => ({ ...u, gastosDirectos: plano(u.gastosDirectos) })),
    generales: plano(generales),
    subtotalConocido: subtotales,
    consolidado: {
      completo: ingresos !== null && utilidadOperativa !== null,
      ingresos: r2(ingresos),
      costoMercancia: r2(total("costoMercancia")),
      utilidadBruta: r2(utilidadBruta),
      margenBrutoPct: r1(pct(utilidadBruta, ingresos)),
      gastosVenta: r2(total("gastosVentaTotal")),
      gastosDirectos: { pagado: r2(total("gastosDirectosPagado")), devengado: r2(total("gastosDirectosDevengado")) },
      gastosGenerales: generales ? { pagado: generales.pagado, devengado: generales.devengado, pendiente: generales.pendiente } : null,
      utilidadOperativa: { pagado: r2(operativaPagado), devengado: r2(operativaDevengado) },
      margenOperativoPct: r1(pct(utilidadOperativa, ingresos)),
      intereses: r2(interesesMonto),
      utilidadAntesISR: r2(utilidadAntesISR),
      isr: r2(isrMonto),
      tipoIsr,
      utilidadNeta: r2(utilidadNeta),
      margenNetoPct: r1(pct(utilidadNeta, ingresos)),
    },
    obligacionesPendientes: hayTesoreria ? r2(unidades.reduce((s, u) => s + (u.gastosDirectos?.pendiente || 0), 0) + (generales?.pendiente || 0)) : null,
    noSonGasto: hayTesoreria ? Object.fromEntries(Object.entries(g.fuera).map(([k, v]) => [k, r2(v)])) : null,
    cargosMarketplace: { excluidosPorDuplicado: g.excluidosPorDuplicado, porConciliar: g.cargosPorConciliar },
    canalesDescartados,
    sucursalesQueNoOperan: noOperan,
    sinClasificar: g.sinClasificar,
    bases: {
      iva: basesUsadas,
      utilidadOperativa: operativaDevengado !== null ? "devengado" : operativaPagado !== null ? "pagado" : null,
      intereses: baseIntereses,
      costo: "costo SICAR (importe − utilidad del reporte)",
    },
    provisional,
    confianza,
    faltantes: [...new Set(faltantes)],
  };
}

/* ───────────── Comparativos ───────────── */

function variacion(actual, anterior) {
  if (vacio(actual) || vacio(anterior)) return { delta: null, pct: null };
  return { delta: r2(actual - anterior), pct: anterior === 0 ? null : r1(((actual - anterior) / Math.abs(anterior)) * 100) };
}

/* ΔUB = (I₂ − I₁)·m₁ + I₂·(m₂ − m₁); la suma es exacta. */
export function efectoVolumenMargen(anterior, actual) {
  const i1 = anterior?.ingresos, i2 = actual?.ingresos, b1 = anterior?.utilidadBruta, b2 = actual?.utilidadBruta;
  if ([i1, i2, b1, b2].some(vacio) || i1 === 0) return null;
  const m1 = b1 / i1;
  const m2 = i2 === 0 ? m1 : b2 / i2;
  return { volumen: r2((i2 - i1) * m1), margen: r2(i2 * (m2 - m1)), total: r2(b2 - b1) };
}

/*
 * Unidad comparable entre dos meses: opera en ambos, con cobertura y
 * costo completos y las mismas bases de IVA. Las demás quedan fuera con
 * su motivo (apertura, cierre, datos incompletos).
 */
function comparables(previo, actual) {
  const incluidas = [];
  const excluidas = [];
  const mismasBases = JSON.stringify(previo.bases.iva) === JSON.stringify(actual.bases.iva);
  for (const u of actual.unidades) {
    const p = previo.unidades.find((x) => x.unidad === u.unidad);
    let motivo = null;
    if (!p) motivo = "no operaba en el mes comparado (apertura o sin datos)";
    else if (!mismasBases) motivo = "bases de IVA distintas entre los meses";
    else if (u.ingresos === null || p.ingresos === null) motivo = "cobertura o ingresos incompletos en alguno de los meses";
    else if (u.utilidadBruta === null || p.utilidadBruta === null) motivo = "costo incompleto en alguno de los meses";
    if (motivo) excluidas.push({ unidad: u.unidad, nombre: u.nombre, motivo });
    else incluidas.push([p, u]);
  }
  for (const p of previo.unidades) {
    if (!actual.unidades.some((u) => u.unidad === p.unidad)) excluidas.push({ unidad: p.unidad, nombre: p.nombre, motivo: "no opera este mes (cierre o sin datos)" });
  }
  return { incluidas, excluidas };
}

const sumaPares = (pares, lado, campo) => sumarTodos(pares.map((par) => par[lado][campo]));

function gastosPorCategoria(estado) {
  const acc = {};
  for (const b of [estado.generales, ...estado.unidades.map((u) => u.gastosDirectos)].filter(Boolean)) {
    for (const f of b.porCategoria) acc[f.categoria] = (acc[f.categoria] || 0) + (f.devengado ?? 0);
  }
  return acc;
}

/*
 * Comparativo mensual de un solo negocio, sobre periodos equivalentes:
 * mismas unidades con cobertura completa en ambos meses, venta promedio
 * diaria, efecto volumen/margen, gastos devengados por categoría, contra
 * el mes anterior y el mismo mes del año anterior. Un mes en curso no se
 * compara.
 */
export function compararMeses(estados = []) {
  const lista = [...(estados || [])].filter((e) => e?.mes && e?.unidades).sort((a, b) => a.mes.localeCompare(b.mes));
  if (new Set(lista.map((e) => String(e.businessId))).size > 1) return { calculable: false, faltantes: ["estados de un solo negocio"] };
  const porMes = new Map(lista.map((e) => [e.mes, e]));
  const anioAnterior = (mes) => `${Number(mes.slice(0, 4)) - 1}${mes.slice(4)}`;

  const contra = (actual, previo) => {
    if (!previo || actual.parcial || previo.parcial) return null;
    const { incluidas, excluidas } = comparables(previo, actual);
    const i1 = sumaPares(incluidas, 0, "ingresos"), i2 = sumaPares(incluidas, 1, "ingresos");
    const b1 = sumaPares(incluidas, 0, "utilidadBruta"), b2 = sumaPares(incluidas, 1, "utilidadBruta");
    const a = gastosPorCategoria(actual), b = gastosPorCategoria(previo);
    return {
      mesComparado: previo.mes,
      unidadesComparadas: incluidas.map(([, u]) => u.unidad),
      unidadesExcluidas: excluidas,
      ingresos: variacion(i2, i1),
      utilidadBruta: variacion(b2, b1),
      contribucion: variacion(sumaPares(incluidas, 1, "contribucionDevengado"), sumaPares(incluidas, 0, "contribucionDevengado")),
      margenBrutoPp: i1 && i2 && !vacio(b1) && !vacio(b2) ? r1((b2 / i2 - b1 / i1) * 100) : null,
      efectoUtilidadBruta: incluidas.length ? efectoVolumenMargen({ ingresos: i1, utilidadBruta: b1 }, { ingresos: i2, utilidadBruta: b2 }) : null,
      unidades: incluidas.map(([p, u]) => ({
        unidad: u.unidad,
        nombre: u.nombre,
        tipo: u.tipo,
        ingresos: variacion(u.ingresos, p.ingresos),
        ventaPromedioDiaria: variacion(u.ventaPromedioDiaria, p.ventaPromedioDiaria),
        utilidadBruta: variacion(u.utilidadBruta, p.utilidadBruta),
        margenBrutoPp: vacio(u.margenBrutoPct) || vacio(p.margenBrutoPct) ? null : r1(u.margenBrutoPct - p.margenBrutoPct),
        contribucion: variacion(u.contribucionDevengado, p.contribucionDevengado),
        efecto: efectoVolumenMargen(p, u),
      })),
      // Consolidado: solo si ambos meses están completos.
      utilidadOperativa: variacion(actual.consolidado.utilidadOperativa.devengado, previo.consolidado.utilidadOperativa.devengado),
      utilidadNeta: variacion(actual.consolidado.utilidadNeta, previo.consolidado.utilidadNeta),
      gastos: Object.keys({ ...a, ...b })
        .map((k) => ({ categoria: k, actual: r2(a[k] ?? 0), anterior: r2(b[k] ?? 0), ...variacion(a[k] ?? 0, b[k] ?? 0) }))
        .sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0)),
    };
  };

  const meses = lista.map((estado, i) => ({
    mes: estado.mes,
    parcial: estado.parcial,
    confianza: estado.confianza,
    consolidado: estado.consolidado,
    subtotalConocido: estado.subtotalConocido,
    vsMesAnterior: contra(estado, i > 0 ? lista[i - 1] : null),
    vsMismoMesAnioAnterior: contra(estado, porMes.get(anioAnterior(estado.mes))),
    noComparableMotivo: i > 0 && (estado.parcial || lista[i - 1].parcial) ? "Uno de los dos meses está en curso." : null,
  }));
  return { calculable: lista.length > 0, meses, estadosPorMes: Object.fromEntries(lista.map((e) => [e.mes, e])) };
}

/* ───────────── Recomendaciones ───────────── */

/*
 * Desde el último mes cerrado. Impacto mensual estimado (o null),
 * evidencia y acción. Son SUGERENCIAS: nada se ejecuta sin autorización.
 */
export function recomendacionesRentabilidad(comparativo, { umbralGastoPct = 15, umbralGastoMonto = 1000, umbralMargenPp = 2, umbralCargosPct = 35, umbralCancelacionPct = 5 } = {}) {
  const mes = (comparativo?.meses || []).filter((m) => !m.parcial).at(-1);
  if (!mes) return [];
  const estado = comparativo.estadosPorMes?.[mes.mes];
  const recs = [];
  const agregar = (rec) => recs.push({ tipo: "RECOMENDACION", requiereAutorizacion: true, mes: mes.mes, confianza: mes.confianza, ...rec });

  for (const u of estado?.unidades || []) {
    const contribucion = u.contribucionDevengado ?? u.contribucionPagado;
    if (contribucion !== null && contribucion < 0) {
      agregar({
        clave: `contribucion_negativa:${u.unidad}`,
        titulo: `${u.nombre} pierde dinero antes de gastos generales`,
        impactoMensual: r2(-contribucion),
        evidencia: `Contribución ${contribucion} (base ${u.contribucionDevengado !== null ? "devengado" : "pagado"}) con ingresos de ${u.ingresos}.`,
        accion: u.tipo === "canal"
          ? "Revisar precios contra el precio mínimo rentable y pausar publicaciones con pérdida (con tu autorización)."
          : "Revisar renta, nómina y horario de la sucursal contra sus ventas por hora.",
      });
    }
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
    const cargos = u.indicadores?.cargosPct;
    if (!vacio(cargos) && cargos > umbralCargosPct) {
      agregar({
        clave: `cargos_altos:${u.unidad}`,
        titulo: `Comisiones y envíos de ${u.nombre} se llevan ${cargos}% de la venta`,
        impactoMensual: u.ingresos === null ? null : r2(u.ingresos * ((cargos - umbralCargosPct) / 100)),
        evidencia: `Referencia ${umbralCargosPct}%.`,
        accion: "Revisar envío gratis en productos baratos, kits para subir el ticket y tipo de publicación.",
      });
    }
    const cancel = u.indicadores?.tasaCancelacionPct;
    if (!vacio(cancel) && cancel > umbralCancelacionPct) {
      agregar({
        clave: `cancelaciones:${u.unidad}`,
        titulo: `${u.nombre} cancela ${cancel}% de las órdenes`,
        impactoMensual: null,
        evidencia: "Ver diagnóstico de cancelaciones por causa.",
        accion: "Atender primero las cancelaciones atribuibles al vendedor (stock, tiempos).",
      });
    }
    if (u.gastosDirectos?.pendiente) {
      agregar({
        clave: `pendiente:${u.unidad}`,
        titulo: `${u.nombre}: ${u.gastosDirectos.pendiente} de obligaciones del mes sin pago registrado`,
        impactoMensual: null,
        evidencia: u.gastosDirectos.porCategoria.filter((f) => f.pendiente).map((f) => `${f.categoria}: ${f.pendiente}`).join("; "),
        accion: "Confirmar si ya se pagó (registrar en Tesorería) o programar el pago.",
      });
    }
  }

  for (const u of mes.vsMesAnterior?.unidades || []) {
    if (u.margenBrutoPp !== null && u.margenBrutoPp <= -umbralMargenPp && u.efecto) {
      agregar({
        clave: `margen_bruto:${u.unidad}`,
        titulo: `El margen bruto de ${u.nombre} bajó ${Math.abs(u.margenBrutoPp)} puntos`,
        impactoMensual: r2(-u.efecto.margen),
        evidencia: `Efecto margen ${u.efecto.margen}; efecto volumen ${u.efecto.volumen}.`,
        accion: "Revisar descuentos, mezcla de productos y costos de compra recientes.",
      });
    }
    const caida = u.ventaPromedioDiaria.pct ?? u.ingresos.pct;
    if (caida !== null && caida <= -10 && (u.margenBrutoPp === null || u.margenBrutoPp > -umbralMargenPp) && u.efecto) {
      agregar({
        clave: `volumen:${u.unidad}`,
        titulo: `La venta de ${u.nombre} bajó ${Math.abs(caida)}% con margen estable`,
        impactoMensual: r2(-u.efecto.volumen),
        evidencia: `Efecto volumen ${u.efecto.volumen}${u.ventaPromedioDiaria.pct !== null ? " (venta por día)" : ""}.`,
        accion: "Revisar quiebres de inventario, tráfico y campañas de la zona.",
      });
    }
  }

  for (const fila of mes.vsMesAnterior?.gastos || []) {
    if (fila.delta !== null && fila.delta >= umbralGastoMonto && (fila.pct === null || fila.pct >= umbralGastoPct)) {
      agregar({
        clave: `gasto:${fila.categoria}`,
        titulo: `El gasto de ${fila.categoria.toLowerCase()} subió ${fila.delta}`,
        impactoMensual: fila.delta,
        evidencia: `De ${fila.anterior} a ${fila.actual}${fila.pct === null ? "" : ` (${fila.pct}%)`}, base devengado.`,
        accion: "Confirmar si es recurrente, extraordinario o un registro duplicado.",
      });
    }
  }

  const c = mes.consolidado;
  const uo = c.utilidadOperativa?.devengado ?? c.utilidadOperativa?.pagado ?? null;
  if (c.intereses !== null && uo !== null && uo > 0 && c.intereses / uo >= 0.3) {
    agregar({
      clave: "intereses",
      titulo: `Los intereses se llevan ${r1((c.intereses / uo) * 100)}% de la utilidad operativa`,
      impactoMensual: null,
      evidencia: `Intereses ${c.intereses}; utilidad operativa ${uo}.`,
      accion: "Abonar primero a la deuda de mayor tasa (simulador de pago de deuda).",
    });
  }
  if (estado?.sinClasificar?.length) {
    agregar({
      clave: "clasificar",
      titulo: `${estado.sinClasificar.length} movimiento(s) de Tesorería sin clasificar`,
      impactoMensual: null,
      evidencia: "Mientras no se clasifiquen, la utilidad puede estar sobrestimada.",
      accion: "Clasificar en Tesorería (gasto fijo/variable, impuesto, deuda, retiro…).",
    });
  }
  if (estado?.cargosMarketplace?.porConciliar?.length) {
    agregar({
      clave: "conciliar_cargos_marketplace",
      titulo: `${estado.cargosMarketplace.porConciliar.length} cargo(s) de marketplace en Tesorería por conciliar`,
      impactoMensual: null,
      evidencia: "Se restan como cargos distintos de las comisiones de las órdenes; si fueran los mismos, la utilidad está subestimada.",
      accion: "Ligar cada cargo a su canal, cuenta y operación.",
    });
  }
  return recs.sort((a, b) => (b.impactoMensual ?? -1) - (a.impactoMensual ?? -1));
}

export function analizarRentabilidad(estados = [], opciones = {}) {
  const comparativo = compararMeses(estados);
  return { comparativo, recomendaciones: recomendacionesRentabilidad(comparativo, opciones) };
}
