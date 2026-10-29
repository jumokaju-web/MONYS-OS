import { validarCicloLunesDomingo } from "../../inteligencia/utils/cicloFinancieroSemanal.js";

function diaMexico(valor) {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const fecha = new Date(`${valor}T12:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor ? valor : null;
  }
  if (valor === null || valor === undefined || valor === "") return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(fecha);
  const parte = (tipo) => partes.find((item) => item.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function centavos(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 && Number.isSafeInteger(Math.round(numero * 100))
    ? Math.round(numero * 100) : null;
}

const identificador = (valor) => valor === null || valor === undefined ? "" : String(valor).trim();
const estado = (valor) => String(valor || "").trim().toUpperCase();
const identidadFinanciera = (factura) => JSON.stringify([
  "id", "organization_id", "business_id", "periodo_desde", "periodo_hasta", "total",
  "estado_pago", "pagada_en", "estado_conciliacion", "cuenta_id", "movimiento_tesoreria_id",
].map((campo) => factura[campo] ?? null));
const sumar = (filas) => filas.some((fila) => fila.importeCentavos === null)
  ? null : filas.reduce((total, fila) => total + fila.importeCentavos, 0) / 100;

/**
 * Expediente de documentos declarados, no un ingreso adicional de Tesorería.
 * El servicio y el cobro se presentan en bases distintas y nunca se suman.
 * Las fechas observadas del banco no acreditan cobertura completa del estado.
 */
export function resumirExpedienteSemanalFlotilla({
  facturas = [], desde, hasta, revisionBancaria = null, conciliaciones = [], movimientosTesoreria = [],
} = {}) {
  const inicio = diaMexico(desde);
  const fin = diaMexico(hasta);
  const ciclo = validarCicloLunesDomingo(inicio, fin);
  const periodoValido = ciclo.valido;
  const lista = Array.isArray(facturas) ? facturas : [];
  const porId = new Map();
  const vigentes = [];
  let canceladasExcluidas = 0;
  let duplicadosExcluidos = 0;
  for (const factura of lista) {
    if (!factura || typeof factura !== "object") continue;
    const id = identificador(factura.id);
    if (id && porId.has(id)) {
      duplicadosExcluidos += 1;
      const anterior = porId.get(id);
      // Dos versiones incompatibles no permiten elegir una cifra por inferencia.
      if (identidadFinanciera(anterior.factura) !== identidadFinanciera(factura)) anterior.identidadConflictiva = true;
      continue;
    }
    const registro = { factura, identidadConflictiva: false };
    if (id) porId.set(id, registro);
    vigentes.push(registro);
  }
  const registros = vigentes.filter(({ factura, identidadConflictiva }) => {
    if (identidadConflictiva || estado(factura.estado_pago) !== "CANCELADA") return true;
    canceladasExcluidas += 1;
    return false;
  });
  const revisionId = identificador(revisionBancaria?.id);
  const movimientos = Array.isArray(revisionBancaria?.paquete?.movimientos)
    ? revisionBancaria.paquete.movimientos : [];
  const movimientosActuales = Array.isArray(movimientosTesoreria) ? movimientosTesoreria : [];
  const enlaces = (Array.isArray(conciliaciones) ? conciliaciones : [])
    .filter((enlace) => estado(enlace?.estado) === "ACTIVA");
  const fechasBanco = movimientos.flatMap((movimiento) => [
    diaMexico(movimiento?.fecha_operacion), diaMexico(movimiento?.fecha_liquidacion),
  ]).filter(Boolean).sort();
  const usosMovimiento = new Map();
  for (const { factura } of registros) {
    const id = identificador(factura.movimiento_tesoreria_id);
    if (id) usosMovimiento.set(id, (usosMovimiento.get(id) || 0) + 1);
  }
  const filasServicio = [];
  const filasCobro = [];
  let fechasServicioPendientes = 0;
  let fechasCobroPendientes = 0;
  for (const { factura, identidadConflictiva } of registros) {
    const importe = identidadConflictiva ? null : centavos(factura.total);
    const servicioInicio = diaMexico(factura.periodo_desde);
    const servicioFin = diaMexico(factura.periodo_hasta);
    const servicioValido = servicioInicio && servicioFin && servicioInicio <= servicioFin;
    if (!servicioValido || identidadConflictiva) fechasServicioPendientes += 1;
    if (periodoValido && servicioValido && servicioInicio <= fin && servicioFin >= inicio) {
      const periodoParcial = servicioInicio < inicio || servicioFin > fin;
      filasServicio.push({ factura, periodoParcial, montoDocumento: importe === null ? null : importe / 100,
        importeCentavos: periodoParcial ? null : importe });
    }
    if (identidadConflictiva) fechasCobroPendientes += 1;
    if (estado(factura.estado_pago) !== "PAGADA") continue;
    const fechaCobro = diaMexico(factura.pagada_en);
    if (!fechaCobro) fechasCobroPendientes += 1;
    if (!periodoValido || !fechaCobro || fechaCobro < inicio || fechaCobro > fin) continue;
    const fila = { factura, fechaCobro, monto: importe === null ? null : importe / 100,
      importeCentavos: importe, estadoEvidencia: "PENDIENTE_EVIDENCIA", motivo: "Falta un vínculo bancario verificable en la revisión consultada." };
    const movimientoId = identificador(factura.movimiento_tesoreria_id);
    if (!identificador(factura.id) || identidadConflictiva) {
      fila.estadoEvidencia = "IDENTIDAD_PENDIENTE";
      fila.motivo = "La factura no tiene identidad única y consistente para certificar su vínculo.";
    } else if (importe === null || importe <= 0) {
      fila.estadoEvidencia = "IMPORTE_PENDIENTE";
      fila.motivo = "El importe del cobro no está confirmado.";
    } else if (usosMovimiento.get(movimientoId) > 1) {
      fila.motivo = "El mismo movimiento de Tesorería aparece asociado a varias facturas; requiere revisión.";
    } else if (revisionId && movimientoId && identificador(factura.cuenta_id)
      && estado(factura.estado_conciliacion) === "CONCILIADA") {
      const orgFactura = identificador(factura.organization_id);
      const negocioFactura = identificador(factura.business_id);
      const orgRevision = identificador(revisionBancaria.organization_id);
      const candidatos = enlaces.filter((enlace) => orgFactura && negocioFactura && orgFactura === orgRevision
        && identificador(enlace.organization_id) === orgFactura
        && identificador(enlace.cash_movement_id) === movimientoId
        && identificador(enlace.revision_bancaria_id) === revisionId
        && estado(enlace.direccion) === "ENTRADA" && centavos(enlace.monto) === importe);
      if (candidatos.length === 1) {
        const enlace = candidatos[0];
        const bancoId = identificador(enlace.banco_movimiento_id);
        const efectivoActual = movimientosActuales.filter((movimiento) => identificador(movimiento?.id) === movimientoId);
        const actual = efectivoActual.length === 1 ? efectivoActual[0] : null;
        // La revisión puede pertenecer a otro negocio por una cuenta compartida.
        // La atribución económica se acredita con el movimiento vigente, no con su snapshot.
        const movimientoVerificado = actual
          && identificador(actual.organization_id) === orgFactura
          && identificador(actual.business_id) === negocioFactura
          && identificador(actual.account_id) === identificador(factura.cuenta_id)
          && estado(actual.movement_type ?? actual.tipo) === "ENTRADA"
          && estado(actual.status ?? actual.estado) === "REVISADO"
          && centavos(actual.amount ?? actual.monto) === importe;
        const fechaMovimiento = diaMexico(actual?.occurred_at ?? actual?.fecha);
        const abonos = movimientos.filter((movimiento) => bancoId && identificador(movimiento.id) === bancoId);
        const enlaceCompartido = enlaces.filter((item) => identificador(item.revision_bancaria_id) === revisionId
          && identificador(item.banco_movimiento_id) === bancoId).length !== 1;
        if (movimientoVerificado && abonos.length === 1 && !enlaceCompartido && centavos(abonos[0].abono) === importe
          && (centavos(abonos[0].cargo) === 0 || abonos[0].cargo == null)
          && [diaMexico(abonos[0].fecha_operacion), diaMexico(abonos[0].fecha_liquidacion)].includes(fechaCobro)
          && fechaMovimiento && [diaMexico(abonos[0].fecha_operacion), diaMexico(abonos[0].fecha_liquidacion)].includes(fechaMovimiento)) {
          fila.estadoEvidencia = "CONCILIADA_CON_EVIDENCIA";
          fila.motivo = "Factura, movimiento vigente y revisado de Flotilla y abono bancario coinciden en organización, cuenta, importe y fecha.";
          fila.conciliacionId = enlace.id || null;
          fila.bancoMovimientoId = bancoId;
        }
      }
    }
    filasCobro.push(fila);
  }
  const conciliados = filasCobro.filter((fila) => fila.estadoEvidencia === "CONCILIADA_CON_EVIDENCIA");
  return {
    periodoValido, motivoPeriodo: ciclo.motivo, desde: inicio, hasta: fin,
    servicio: { cantidad: filasServicio.length, total: periodoValido && fechasServicioPendientes === 0 ? sumar(filasServicio) : null,
      importesPendientes: filasServicio.filter((fila) => fila.importeCentavos === null).length,
      periodosParciales: filasServicio.filter((fila) => fila.periodoParcial).length,
      fechasPendientes: fechasServicioPendientes, filas: filasServicio },
    cobros: { cantidad: filasCobro.length, total: periodoValido && fechasCobroPendientes === 0 ? sumar(filasCobro) : null,
      importesPendientes: filasCobro.filter((fila) => fila.importeCentavos === null).length,
      fechasPendientes: fechasCobroPendientes, conciliados: conciliados.length,
      pendientes: filasCobro.length - conciliados.length, totalConciliado: sumar(conciliados), filas: filasCobro },
    banco: { revisionId: revisionId || null, desdeObservado: fechasBanco[0] || null,
      hastaObservado: fechasBanco.at(-1) || null, movimientosObservados: movimientos.length,
      coberturaCompletaConfirmada: false },
    identidadPendiente: registros.filter(({ factura, identidadConflictiva }) => !identificador(factura.id) || identidadConflictiva).length,
    canceladasExcluidas, duplicadosExcluidos,
  };
}
