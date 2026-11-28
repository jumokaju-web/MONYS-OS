/*
 * DIAGNÓSTICO DE FUENTES DEL BLOQUE FINANCIERO · MONYS OS
 *
 * Dice, por mes y fuente, si lo que alimenta los motores es REAL,
 * ESTIMADO, PARCIAL o FALTANTE, y qué hacer para completarlo. Lee solo
 * salidas ya calculadas (estado de resultados, equilibrio): no recalcula.
 * Módulo puro.
 */

export const ESTADOS_FUENTE = Object.freeze({ REAL: "real", ESTIMADO: "estimado", PARCIAL: "parcial", FALTANTE: "faltante" });

/*
 * estados: construirEstadoResultados por mes.
 * equilibrio: construirEquilibrioReal del mes en curso (opcional).
 * deudasRegistradas: número de deudas abiertas (null si no se pudo leer).
 */
export function diagnosticarFuentes({ estados = [], equilibrio = null, deudasRegistradas = null } = {}) {
  const filas = [];
  const agregar = (mes, fuente, estado, detalle, accion = null) => filas.push({ mes, fuente, estado, detalle, accion });

  for (const e of estados || []) {
    if (!e?.unidades) continue;
    const mes = e.mes;
    // SICAR por sucursal.
    for (const u of e.unidades.filter((x) => x.tipo === "sucursal")) {
      const c = u.cobertura || {};
      if (u.ingresos !== null && u.costoMercancia !== null) agregar(mes, `SICAR · ${u.nombre}`, ESTADOS_FUENTE.REAL, `${c.completo} día(s) cubiertos${c.cerrado ? `, ${c.cerrado} cerrado(s)` : ""}.`);
      else if (u.ingresosRegistrados) {
        agregar(mes, `SICAR · ${u.nombre}`, ESTADOS_FUENTE.PARCIAL,
          `${c.sin_dato || 0} día(s) sin carga, ${(c.parcial || 0) + (c.sin_confirmar || 0)} parciales o sin periodo, ${c.conflicto || 0} en conflicto; utilidad ${u.costoMercancia === null ? "incompleta" : "completa"}.`,
          c.sin_dato ? `Cargar "Ventas por artículo" de ${c.diasSinDato?.slice(0, 3).join(", ")}${c.sin_dato > 3 ? "…" : ""}` : "Revisar cargas parciales o en conflicto");
      } else agregar(mes, `SICAR · ${u.nombre}`, ESTADOS_FUENTE.FALTANTE, "Sin ventas cargadas del mes.", `Cargar "Ventas por artículo" de ${u.nombre}`);
    }
    // Canales.
    for (const u of e.unidades.filter((x) => x.tipo === "canal")) {
      agregar(mes, u.nombre, u.ingresos !== null ? (u.costoMercancia !== null ? ESTADOS_FUENTE.REAL : ESTADOS_FUENTE.PARCIAL) : ESTADOS_FUENTE.PARCIAL,
        u.ingresos !== null ? (u.costoMercancia !== null ? "Órdenes y costos completos." : "Faltan costos SICAR de publicaciones sin vincular.") : "Sincronización del mes incompleta.",
        u.costoMercancia === null ? "Vincular publicaciones con productos SICAR" : null);
    }
    for (const f of e.faltantes.filter((x) => /sin datos del mes|configuración de canales/.test(x))) agregar(mes, "Canales", ESTADOS_FUENTE.FALTANTE, f, "Activar la conexión de solo lectura (requiere autorización)");

    // Tesorería: gastos registrados, sin clasificar, nómina y renta.
    const bloques = [e.generales, ...e.unidades.map((u) => u.gastosDirectos)].filter(Boolean);
    if (e.noSonGasto === null) agregar(mes, "Tesorería", ESTADOS_FUENTE.FALTANTE, "No se pudieron leer los movimientos.", "Revisar conexión o permisos");
    else {
      const sinClas = e.sinClasificar?.length || 0;
      agregar(mes, "Tesorería", sinClas ? ESTADOS_FUENTE.PARCIAL : ESTADOS_FUENTE.REAL,
        `${sinClas} movimiento(s) sin clasificar. Pagado registrado; el mes no está confirmado como completo.`,
        sinClas ? "Clasificar movimientos en Tesorería" : null);
      for (const [categoria, nombre] of [["NOMINA", "Nómina"], ["RENTA", "Rentas"]]) {
        const pagada = bloques.some((b) => (b.porCategoria || []).some((f) => f.categoria === categoria && f.pagado));
        const obligacion = bloques.some((b) => (b.porCategoria || []).some((f) => f.categoria === categoria && f.fuente === "obligacion"));
        const pendiente = bloques.reduce((s, b) => s + (b.porCategoria || []).filter((f) => f.categoria === categoria).reduce((t, f) => t + (f.pendiente || 0), 0), 0);
        agregar(mes, nombre,
          pagada && obligacion && !pendiente ? ESTADOS_FUENTE.REAL : obligacion ? ESTADOS_FUENTE.ESTIMADO : pagada ? ESTADOS_FUENTE.PARCIAL : ESTADOS_FUENTE.FALTANTE,
          obligacion ? `Devengo por obligación${pendiente ? `; ${pendiente} sin pago registrado` : ""}.` : pagada ? "Solo pagos; sin obligación registrada." : "Sin pagos ni obligación.",
          !obligacion ? `Registrar la obligación de ${nombre.toLowerCase()} por sucursal` : pendiente ? "Registrar el pago en Tesorería o confirmar que sigue pendiente" : null);
      }
    }
    // Calendario, conciliación y bases fiscales.
    if ((e.provisional || []).some((p) => p.includes("Calendario operativo no disponible"))) agregar(mes, "Calendario operativo", ESTADOS_FUENTE.FALTANTE, "Sin calendario: un día sin carga cuenta como faltante.", "Aplicar la migración del calendario (requiere autorización) y registrar cierres");
    if ((e.provisional || []).some((p) => p.includes("Conciliación de plataformas no disponible"))) agregar(mes, "Conciliación de plataformas", ESTADOS_FUENTE.FALTANTE, "Ningún cargo de plataforma se excluye.", "Aplicar la migración de conciliación (requiere autorización)");
    const porConfirmar = Object.entries(e.bases?.iva || {}).filter(([, b]) => b === "por_confirmar").map(([k]) => k);
    agregar(mes, "Bases de IVA", porConfirmar.length ? ESTADOS_FUENTE.ESTIMADO : ESTADOS_FUENTE.REAL,
      porConfirmar.length ? `Por confirmar: ${porConfirmar.join(", ")}. Resultados provisionales.` : "Confirmadas.",
      porConfirmar.length ? "Confirmar con el contador si cada fuente incluye IVA" : null);
    agregar(mes, "ISR", e.consolidado?.tipoIsr === "DEL_CONTADOR" ? ESTADOS_FUENTE.REAL : e.consolidado?.tipoIsr ? ESTADOS_FUENTE.ESTIMADO : ESTADOS_FUENTE.FALTANTE,
      e.consolidado?.tipoIsr ? `Tipo: ${e.consolidado.tipoIsr}.` : "Sin monto ni tasa.", e.consolidado?.tipoIsr === "DEL_CONTADOR" ? null : "Pedir al contador el ISR del mes o la tasa");
  }

  // Créditos e intereses (motor de equilibrio).
  if (deudasRegistradas === null) agregar(null, "Créditos", ESTADOS_FUENTE.FALTANTE, "No se pudieron leer las deudas.", "Revisar permisos de deudas");
  else if (equilibrio) {
    const intereses = equilibrio?.indicadores?.utilidadNeta?.interesesDevengadosEstimados;
    agregar(null, "Créditos", intereses === undefined || intereses === null ? ESTADOS_FUENTE.PARCIAL : ESTADOS_FUENTE.ESTIMADO,
      `${deudasRegistradas} deuda(s) abiertas; intereses ${intereses === undefined || intereses === null ? "sin tasa o saldo" : "estimados con saldo × tasa"}.`,
      intereses === undefined || intereses === null ? "Completar tasa y saldo de cada crédito" : null);
  }
  const orden = { faltante: 0, parcial: 1, estimado: 2, real: 3 };
  return filas.sort((a, b) => orden[a.estado] - orden[b.estado] || String(a.mes).localeCompare(String(b.mes)));
}
