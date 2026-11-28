/*
 * RECOMENDACIONES PARA "QUÉ HACER HOY" · contrato v2 · MONYS OS
 *
 * Une en una sola forma:
 * - las recomendaciones de rentabilidad (estado de resultados, #171),
 * - las urgencias de efectivo del equilibrio por sucursal,
 * - y las acciones del día de #163 (traspasos, compras, abonos a deuda).
 * No recalcula montos: los toma de cada motor.
 *
 * Cada elemento:
 * { id (estable), version: 2, grupo: urgencia_liquidez | oportunidad | calidad_datos,
 *   categoria: ventas | inventario | finanzas | datos,
 *   tipoImpacto: utilidad | efectivo | ahorro | recuperacion_ventas | riesgo,
 *   impacto: { importe|null, medida, unidad: "MXN", periodo: { tipo, mes|dias }, estado: estimado|pendiente, base },
 *   ventasAsociadas|null   (venta, nunca sumada con utilidad),
 *   confianza, alcance: { tipo: sucursal|canal|negocio, businessId, branchId, cuentaId, canal, nombre },
 *   titulo, motivo, evidencia, accion: { texto, destino, parametros },
 *   grupoExclusivo, alternativaDe, duplicadoDe, motivoNoSumar,
 *   faltantes[], requiereAutorizacion: true }
 *
 * Reglas:
 * - Las mejoras de utilidad de una misma unidad se traslapan (recuperar
 *   margen reduce la pérdida): solo la mayor es principal; las demás son
 *   alternativas y no se suman.
 * - Totales solo de principales, por medida y periodo; nunca se suma
 *   utilidad con efectivo ni con ventas.
 * - Urgencias de liquidez y calidad de datos van aparte de las
 *   oportunidades comerciales.
 * Módulo puro.
 */

export const GRUPOS = Object.freeze({ LIQUIDEZ: "urgencia_liquidez", OPORTUNIDAD: "oportunidad", DATOS: "calidad_datos" });
export const TIPOS_IMPACTO = Object.freeze({ UTILIDAD: "utilidad", EFECTIVO: "efectivo", AHORRO: "ahorro", RECUPERACION_VENTAS: "recuperacion_ventas", RIESGO: "riesgo" });

const r2 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const ORDEN_CONFIANZA = { baja: 0, media: 1, alta: 2 };

/* Reglas por tipo de recomendación de rentabilidad. */
const REGLAS = {
  contribucion_negativa: (u) => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.UTILIDAD, medida: "utilidad_operativa", categoria: u?.tipo === "canal" ? "ventas" : "finanzas", destino: u?.tipo === "canal" ? "canales/precio-minimo" : "finanzas/estado-resultados", exclusivo: true, motivo: "La unidad no cubre sus propios gastos con su utilidad bruta." }),
  productos_con_perdida: () => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.UTILIDAD, medida: "utilidad_bruta", categoria: "ventas", destino: "canales/precio-minimo", exclusivo: true, motivo: "Publicaciones cuyo precio no cubre costo, comisión y envío." }),
  cargos_altos: () => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.AHORRO, medida: "gasto_evitado", categoria: "ventas", destino: "canales/rentabilidad", exclusivo: true, motivo: "Comisiones y envíos por encima de la referencia." }),
  cancelaciones: () => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.RIESGO, medida: null, categoria: "ventas", destino: "canales/cancelaciones", faltantes: ["ventas perdidas por cancelaciones atribuibles al vendedor"], motivo: "Cancelaciones que afectan reputación y ventas." }),
  pendiente: () => ({ grupo: GRUPOS.LIQUIDEZ, tipoImpacto: TIPOS_IMPACTO.EFECTIVO, medida: "efectivo_por_pagar", categoria: "finanzas", destino: "tesoreria/obligaciones", motivo: "Obligaciones del mes sin pago registrado." }),
  margen_bruto: () => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.UTILIDAD, medida: "utilidad_bruta", categoria: "inventario", destino: "inventario/costos", exclusivo: true, motivo: "El margen bruto bajó contra el mes comparable." }),
  volumen: () => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.RECUPERACION_VENTAS, medida: "utilidad_bruta", categoria: "ventas", destino: "ventas/sucursal", exclusivo: true, motivo: "La venta bajó con margen estable: el problema es volumen." }),
  gasto: () => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.AHORRO, medida: "gasto_evitado", categoria: "finanzas", destino: "tesoreria/movimientos", motivo: "Un gasto subió contra el mes comparable." }),
  intereses: () => ({ grupo: GRUPOS.LIQUIDEZ, tipoImpacto: TIPOS_IMPACTO.RIESGO, medida: null, categoria: "finanzas", destino: "finanzas/deudas", faltantes: ["monto de abono a simular"], motivo: "Los intereses se comen buena parte de la utilidad operativa." }),
  clasificar: () => ({ grupo: GRUPOS.DATOS, tipoImpacto: TIPOS_IMPACTO.RIESGO, medida: null, categoria: "datos", destino: "tesoreria/clasificar", motivo: "Sin clasificar, la utilidad puede estar sobrestimada." }),
  conciliar_cargos_marketplace: () => ({ grupo: GRUPOS.DATOS, tipoImpacto: TIPOS_IMPACTO.RIESGO, medida: null, categoria: "datos", destino: "tesoreria/conciliar", motivo: "Cargos de plataforma sin ligar a operaciones." }),
};

function alcanceDe(unidad, businessId) {
  if (!unidad) return { tipo: "negocio", businessId, branchId: null, cuentaId: null, canal: null, nombre: "Negocio" };
  if (unidad.tipo === "canal") return { tipo: "canal", businessId, branchId: null, cuentaId: String(unidad.unidad).replace(/^canal:/, ""), canal: unidad.canal ?? null, nombre: unidad.nombre };
  return { tipo: "sucursal", businessId, branchId: unidad.unidad, cuentaId: null, canal: null, nombre: unidad.nombre };
}

const faltantesDeUnidad = (estado, unidad) =>
  (estado?.faltantes || []).filter((f) => (unidad?.nombre && f.startsWith(`${unidad.nombre}:`)) || (unidad?.canal && f.startsWith(`${unidad.canal}:`)));

/*
 * Recomendaciones de rentabilidad (recomendacionesRentabilidad) a v2.
 * comparativo: salida de compararMeses (trae estadosPorMes).
 */
export function normalizarRecomendaciones({ businessId, recomendaciones = [], comparativo = null } = {}) {
  return (recomendaciones || []).map((rec) => {
    const [tipo, ...resto] = String(rec.clave).split(":");
    const unidadId = resto.join(":") || null;
    const estado = comparativo?.estadosPorMes?.[rec.mes] || null;
    const unidad = unidadId ? estado?.unidades?.find((u) => u.unidad === unidadId) || null : null;
    const regla = (REGLAS[tipo] || (() => ({ grupo: GRUPOS.OPORTUNIDAD, tipoImpacto: TIPOS_IMPACTO.RIESGO, medida: null, categoria: "finanzas", destino: "finanzas/estado-resultados" })))(unidad);
    let importe = rec.impactoMensual ?? null;
    let ventasAsociadas = null;
    if (tipo === "pendiente") importe = unidad?.gastosDirectos?.pendiente ?? null;
    if (tipo === "volumen") {
      const v = comparativo?.meses?.find((m) => m.mes === rec.mes)?.vsMesAnterior?.unidades?.find((x) => x.unidad === unidadId);
      ventasAsociadas = v?.ingresos?.delta === null || v?.ingresos?.delta === undefined ? null : r2(-v.ingresos.delta);
    }
    // Estable: tipo + mes + unidad (o categoría de gasto). El mismo hallazgo
    // en el mismo mes conserva su id entre consultas.
    const id = `rentabilidad:${tipo}:${rec.mes}:${unidadId ?? "negocio"}`;
    return {
      id,
      version: 2,
      origen: "rentabilidad",
      grupo: regla.grupo,
      categoria: regla.categoria,
      tipoImpacto: regla.tipoImpacto,
      impacto: {
        importe: r2(importe),
        medida: regla.medida,
        unidad: "MXN",
        periodo: { tipo: "mensual", mes: rec.mes },
        estado: importe === null ? "pendiente" : "estimado",
        base: tipo === "contribucion_negativa" ? (unidad?.contribucionDevengado !== null && unidad?.contribucionDevengado !== undefined ? "devengado" : "pagado") : tipo === "gasto" ? "devengado" : null,
      },
      ventasAsociadas,
      confianza: rec.confianza ?? estado?.confianza ?? "baja",
      alcance: alcanceDe(unidad, businessId),
      titulo: rec.titulo,
      motivo: regla.motivo || "",
      evidencia: rec.evidencia || "",
      accion: { texto: rec.accion, destino: regla.destino, parametros: tipo === "gasto" ? { mes: rec.mes, categoria: unidadId } : { mes: rec.mes, unidad: unidadId } },
      grupoExclusivo: regla.exclusivo && unidadId ? `utilidad:${unidadId}` : null,
      alternativaDe: null,
      duplicadoDe: null,
      motivoNoSumar: null,
      faltantes: [...new Set([...(regla.faltantes || []), ...faltantesDeUnidad(estado, unidad), ...(importe === null && regla.medida ? ["datos para estimar el importe"] : [])])],
      requiereAutorizacion: true,
    };
  });
}

/* Urgencias de efectivo: sucursales cuya venta actual no alcanza lo que les vence. */
export function urgenciasDeEquilibrio({ businessId, equilibrio = null } = {}) {
  return (equilibrio?.sucursales || []).flatMap((s) => {
    const e = s.efectivo;
    if (!e || e.brechaDiaria === null || e.brechaDiaria >= 0 || s.margenContribucionPct === null) return [];
    const ventasFaltantes = -e.brechaDiaria * s.diasConVentaEsperada;
    return [{
      id: `liquidez:efectivo:${equilibrio.mesObjetivo}:${s.unidad}`,
      version: 2,
      origen: "equilibrio",
      grupo: GRUPOS.LIQUIDEZ,
      categoria: "finanzas",
      tipoImpacto: TIPOS_IMPACTO.EFECTIVO,
      impacto: {
        importe: r2(ventasFaltantes * (s.margenContribucionPct / 100)),
        medida: "deficit_efectivo",
        unidad: "MXN",
        periodo: { tipo: "mensual", mes: equilibrio.mesObjetivo },
        estado: "estimado",
        base: "lo que vence en el mes",
      },
      ventasAsociadas: r2(ventasFaltantes),
      confianza: s.faltantes.length ? "baja" : s.avisos.length ? "media" : "alta",
      alcance: { tipo: "sucursal", businessId, branchId: s.unidad, cuentaId: null, canal: null, nombre: s.nombre },
      titulo: `${s.nombre} no alcanza a pagar lo que le vence este mes al ritmo actual`,
      motivo: `Necesita vender ${e.ventaDiaria} al día y vende ${s.ventaDiariaActual}.`,
      evidencia: `Margen de contribución ${s.margenContribucionPct}% (mes base ${s.mesBase}); ${s.diasConVentaEsperada} días con venta esperada.`,
      accion: { texto: "Revisar qué pagos pueden moverse y qué ventas se pueden adelantar.", destino: "finanzas/venta-necesaria", parametros: { mes: equilibrio.mesObjetivo, unidad: s.unidad } },
      grupoExclusivo: null,
      alternativaDe: null,
      duplicadoDe: null,
      motivoNoSumar: null,
      faltantes: [...s.faltantes, ...s.avisos],
      requiereAutorizacion: true,
    }];
  });
}

/* Acciones del día de #163 (traspaso, compra, pago_deuda) a v2. */
export function accionesDelDiaAContrato({ businessId, acciones = [], hoy = null } = {}) {
  const REGLA = {
    traspaso: { tipoImpacto: TIPOS_IMPACTO.RECUPERACION_VENTAS, medida: "utilidad_bruta", categoria: "inventario", destino: "inventario/traspasos" },
    compra: { tipoImpacto: TIPOS_IMPACTO.UTILIDAD, medida: "utilidad_bruta", categoria: "inventario", destino: "inventario/compras" },
    pago_deuda: { tipoImpacto: TIPOS_IMPACTO.AHORRO, medida: "intereses_evitados", categoria: "finanzas", destino: "finanzas/deudas" },
  };
  return (acciones || []).map((a) => {
    const regla = REGLA[a.tipo] || { tipoImpacto: TIPOS_IMPACTO.RIESGO, medida: null, categoria: "finanzas", destino: "dashboard" };
    const importe = a.impacto?.ganancia ?? a.impacto?.ahorro ?? null;
    const dias = a.impacto?.diasHorizonte ?? a.impacto?.dias ?? 30;
    // Traspaso: la sucursal destino viene en el id (traspaso:<código>:<origen>:<destino>).
    const destinoTraspaso = a.tipo === "traspaso" ? String(a.id).split(":")[3] || null : null;
    // "Capturar la tasa" no es una oportunidad: es un dato faltante.
    const esDato = a.id === "deuda:sin-tasa";
    return {
      id: `hoy:${a.id}`,
      version: 2,
      origen: "acciones_del_dia",
      grupo: esDato ? GRUPOS.DATOS : GRUPOS.OPORTUNIDAD,
      categoria: esDato ? "datos" : regla.categoria,
      tipoImpacto: regla.tipoImpacto,
      impacto: { importe: r2(importe), medida: regla.medida, unidad: "MXN", periodo: { tipo: "dias", dias, desde: hoy }, estado: importe === null ? "pendiente" : "estimado", base: a.impacto?.estado ?? null },
      ventasAsociadas: null,
      confianza: a.impacto?.confianza ?? "media",
      alcance: destinoTraspaso || a.branchId
        ? { tipo: "sucursal", businessId, branchId: a.branchId ?? destinoTraspaso, cuentaId: null, canal: null, nombre: a.sucursal ?? a.detalle ?? "Sucursal" }
        : { tipo: "negocio", businessId, branchId: null, cuentaId: null, canal: null, nombre: "Negocio" },
      titulo: a.titulo,
      motivo: a.detalle || "",
      evidencia: (a.impacto?.supuestos || []).join("; "),
      accion: { texto: "Revisar propuesta", destino: regla.destino, parametros: { id: a.id } },
      grupoExclusivo: a.grupoExclusivo ? `hoy:${a.grupoExclusivo}` : null,
      alternativaDe: a.alternativaDe ? `hoy:${a.alternativaDe}` : null,
      duplicadoDe: null,
      motivoNoSumar: a.alternativaDe ? "Alternativa excluyente de otra acción." : null,
      faltantes: a.impacto?.faltantes || [],
      requiereAutorizacion: true,
    };
  });
}

/*
 * Junta todo, marca alternativas y duplicados, y arma las vistas:
 * - urgenciasLiquidez: aparte, por importe.
 * - prioridades: las 3 oportunidades principales con importe.
 * - porCategoria: ventas / inventario / finanzas / datos.
 * - totales: solo principales, por grupo · medida · periodo.
 */
export function prioridadesDeHoy(listas = []) {
  const todas = listas.flat().map((r) => ({ ...r }));
  // Duplicados: la recomendación de intereses se cubre con el abono de #163.
  const abono = todas.find((r) => r.origen === "acciones_del_dia" && r.impacto.medida === "intereses_evitados" && !r.alternativaDe);
  for (const r of todas) {
    if (abono && r.id.startsWith("rentabilidad:intereses:")) {
      r.duplicadoDe = abono.id;
      r.motivoNoSumar = "La misma decisión ya está como abono a deuda.";
    }
  }
  // Alternativas: en cada grupo exclusivo la de mayor importe es principal.
  const grupos = new Map();
  for (const r of todas) {
    if (!r.grupoExclusivo || r.alternativaDe || r.duplicadoDe) continue;
    if (!grupos.has(r.grupoExclusivo)) grupos.set(r.grupoExclusivo, []);
    grupos.get(r.grupoExclusivo).push(r);
  }
  for (const miembros of grupos.values()) {
    if (miembros.length < 2) continue;
    miembros.sort((a, b) => (b.impacto.importe ?? -Infinity) - (a.impacto.importe ?? -Infinity));
    for (const r of miembros.slice(1)) {
      r.alternativaDe = miembros[0].id;
      r.motivoNoSumar = `Se traslapa con "${miembros[0].titulo}": no se suman.`;
    }
  }
  const principal = (r) => !r.alternativaDe && !r.duplicadoDe;
  const porImporte = (a, b) => (b.impacto.importe ?? -1) - (a.impacto.importe ?? -1) || ORDEN_CONFIANZA[b.confianza] - ORDEN_CONFIANZA[a.confianza];

  const totales = {};
  for (const r of todas.filter(principal)) {
    if (r.impacto.importe === null || !r.impacto.medida) continue;
    const periodo = r.impacto.periodo.tipo === "mensual" ? `mes:${r.impacto.periodo.mes}` : `dias:${r.impacto.periodo.dias}`;
    const clave = `${r.grupo}|${r.impacto.medida}|${periodo}`;
    totales[clave] ||= { grupo: r.grupo, medida: r.impacto.medida, periodo: r.impacto.periodo, importe: 0, cuantas: 0 };
    totales[clave].importe = r2(totales[clave].importe + r.impacto.importe);
    totales[clave].cuantas += 1;
  }
  const oportunidades = todas.filter((r) => r.grupo === GRUPOS.OPORTUNIDAD && principal(r)).sort(porImporte);
  return {
    version: 2,
    urgenciasLiquidez: todas.filter((r) => r.grupo === GRUPOS.LIQUIDEZ && principal(r)).sort(porImporte),
    prioridades: oportunidades.filter((r) => r.impacto.importe !== null).slice(0, 3),
    calidadDatos: todas.filter((r) => r.grupo === GRUPOS.DATOS),
    porCategoria: Object.fromEntries(["ventas", "inventario", "finanzas", "datos"].map((c) => [c, todas.filter((r) => r.categoria === c).sort(porImporte)])),
    todas,
    totales: Object.values(totales),
    nota: "Totales solo de recomendaciones principales, por medida y periodo. Utilidad, efectivo y ventas no se suman entre sí.",
  };
}
