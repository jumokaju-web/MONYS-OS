import { resumirDestinoEfectivoRetirado } from "./destinoEfectivoRetirado.js";
import { integrarComprobacionesRetiros } from "./comprobacionRetiros.js";

const ZONA_MEXICO = "America/Mexico_City";

function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function fechaISOValida(valor) {
  const fecha = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaUTC = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(fechaUTC.getTime()) && fechaUTC.toISOString().slice(0, 10) === fecha;
}

export function fechaMexico(valor = new Date()) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_MEXICO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const obtener = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${obtener("year")}-${obtener("month")}-${obtener("day")}`;
}

function datosProveedores(reporte = {}, hoy = fechaMexico()) {
  const fuenteCompleta = reporte?.fuenteCompleta !== false;
  const creditos = Array.isArray(reporte?.creditos) ? reporte.creditos : [];
  let compromisos7Dias = 0;
  let sinFecha = 0;
  let saldosPendientes = 0;
  const limite = new Date(`${hoy}T12:00:00-06:00`);
  limite.setDate(limite.getDate() + 7);
  const fechaLimite = fechaMexico(limite);
  const fechaImportacion = String(reporte?.fechaCorte || reporte?.importacion?.created_at || reporte?.confirmacion?.fecha_corte || "").slice(0, 10) || null;
  const fechasConfirmacionesCero = reporte?.confirmacionesCeroFechas || [];
  const confirmacionesCeroVigentes = reporte?.confirmacionesCeroCompletas !== false && fechasConfirmacionesCero.every((fecha) => {
    const dias = Math.floor((new Date(`${hoy}T12:00:00Z`).getTime() - new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`).getTime()) / 86400000);
    return dias >= 0 && dias <= 7;
  });
  const antiguedadDias = fechaImportacion
    ? Math.floor(
      (new Date(`${hoy}T12:00:00Z`).getTime() - new Date(`${fechaImportacion}T12:00:00Z`).getTime()) / 86400000
    )
    : null;

  let total = 0;
  for (const credito of creditos) {
    const saldo = numeroONulo(credito?.saldo);
    if (saldo === null || saldo < 0) {
      saldosPendientes += 1;
      continue;
    }
    if (saldo <= 0) continue;
    total += saldo;
    const vencimiento = String(
      credito?.fecha_vencimiento || credito?.fecha_vencimiento_estimada || ""
    ).slice(0, 10);
    if (!vencimiento) {
      sinFecha += 1;
      continue;
    }
    if (vencimiento <= fechaLimite) compromisos7Dias += saldo;
  }

  return {
    disponible: fuenteCompleta && Boolean(reporte?.importacion || reporte?.disponible),
    fechaImportacion,
    antiguedadDias,
    vigente: reporte?.fuente === "confirmacion_cero"
      ? fuenteCompleta && antiguedadDias !== null && antiguedadDias >= 0 && antiguedadDias <= 7
      : fuenteCompleta && Boolean(reporte?.importacion) && antiguedadDias !== null && antiguedadDias >= 0 && antiguedadDias <= 30 && confirmacionesCeroVigentes,
    compromisos7Dias,
    sinFecha,
    saldosPendientes,
    total,
  };
}

function datosDeudas(deudas = [], consultadas = false, hoy = fechaMexico()) {
  const activas = Array.isArray(deudas)
    ? deudas.filter((deuda) => ["ACTIVA", "REESTRUCTURADA"].includes(String(deuda?.estado || "").toUpperCase()))
    : [];
  const limite = new Date(`${hoy}T12:00:00-06:00`);
  limite.setDate(limite.getDate() + 7);
  const fechaLimite = fechaMexico(limite);
  let compromisos7Dias = 0;
  let incompletas = 0;
  let frecuenciasAmbiguas = 0;
  for (const deuda of activas) {
    const pago = numeroONulo(deuda?.pago_mensual);
    const fecha = String(deuda?.fecha_proximo_pago || "").slice(0, 10);
    const textoFrecuencia = `${deuda?.nombre || ""} ${deuda?.notas || ""}`.toLocaleLowerCase("es-MX");
    const frecuenciaAmbigua = /\b(diari[oa]s?|semanal(?:es)?|quincenal(?:es)?)\b/.test(textoFrecuencia);
    if (frecuenciaAmbigua) frecuenciasAmbiguas += 1;
    if (pago === null || pago < 0 || !fechaISOValida(fecha) || frecuenciaAmbigua) {
      incompletas += 1;
      continue;
    }
    if (fecha <= fechaLimite) compromisos7Dias += pago;
  }
  return {
    consultadas,
    activas: activas.length,
    compromisos7Dias,
    incompletas,
    frecuenciasAmbiguas,
    completas: consultadas && incompletas === 0,
  };
}

export function resumirDisponibilidadFinanciera({
  cuentas = [],
  cierre = {},
  cortesOficiales = {},
  creditosProveedores = {},
  deudasFinancieras = [],
  deudasConsultadas = false,
  obligacionesOperativas = {},
  obligacionesOperativasConfirmadas = false,
  comprobacionesRetiros = [],
  hoy = fechaMexico(),
} = {}) {
  const listaCuentas = Array.isArray(cuentas) ? cuentas : [];
  const detalleCuentas = listaCuentas.map((cuenta) => {
    const saldo = numeroONulo(cuenta?.saldo);
    // A recent movement can estimate a balance, but it is not a fresh bank confirmation.
    const fechaSaldo = fechaMexico(cuenta?.fechaSaldo || cuenta?.fechaActualizacion);
    return {
      ...cuenta,
      saldo,
      fechaSaldo,
      confirmadaHoy: saldo !== null && fechaSaldo === hoy,
    };
  });
  const cuentasPendientes = detalleCuentas.filter((cuenta) => !cuenta.confirmadaHoy);
  const bancosVigentes = detalleCuentas.length > 0 && cuentasPendientes.length === 0;
  const saldoBancos = detalleCuentas.every((cuenta) => cuenta.saldo !== null)
    ? detalleCuentas.reduce((total, cuenta) => total + cuenta.saldo, 0)
    : null;

  const cajasEsperadas = Math.max(0, Number(cierre?.cajasEsperadas) || Number(cortesOficiales?.cajasEsperadas) || 0);
  const cierreManualCompleto = cajasEsperadas > 0
    && Math.max(0, Number(cierre?.cajasFaltantes) || 0) === 0
    && Math.max(0, Number(cierre?.cajasIncompletas) || 0) === 0;
  const corteOficialCompleto = cortesOficiales?.completo === true;
  const fuenteCajas = corteOficialCompleto ? "SICAR_OFICIAL" : cierreManualCompleto ? "CIERRE_EQUIPO" : "PENDIENTE";
  const cajasCompletas = fuenteCajas !== "PENDIENTE";
  const cajasFaltantes = corteOficialCompleto
    ? 0
    : cierreManualCompleto ? 0 : Math.max(0, Number(cortesOficiales?.cajasFaltantes) || Number(cierre?.cajasFaltantes) || 0);
  const cajasIncompletas = corteOficialCompleto
    ? 0
    : cierreManualCompleto ? 0 : Math.max(0, Number(cortesOficiales?.cajasIncompletas) || Number(cierre?.cajasIncompletas) || 0);
  const efectivoCajas = corteOficialCompleto
    ? numeroONulo(cortesOficiales?.efectivoEnCaja)
    : cierreManualCompleto ? numeroONulo(cierre?.efectivoFinal) : null;
  const efectivoResguardado = corteOficialCompleto
    ? numeroONulo(cortesOficiales?.efectivoRetirado)
    : cierreManualCompleto ? numeroONulo(cierre?.efectivoEntregado) : null;
  const diferencias = corteOficialCompleto
    ? Math.max(0, Number(cortesOficiales?.diferencias) || 0)
    : Math.max(0, Number(cierre?.diferencias) || 0);
  const controlRetiros = resumirDestinoEfectivoRetirado({ cierre, cortesOficiales });
  const comprobacionRetiros = integrarComprobacionesRetiros(controlRetiros.filas, comprobacionesRetiros);
  const proveedores = datosProveedores(creditosProveedores, hoy);
  const deudas = datosDeudas(deudasFinancieras, deudasConsultadas, hoy);

  const liquidezLocalizada = bancosVigentes && cajasCompletas
    ? saldoBancos + (efectivoCajas || 0)
    : null;
  const compromisosConfirmados =
    proveedores.vigente && proveedores.sinFecha === 0 && proveedores.saldosPendientes === 0;
  const operativasCompletas = obligacionesOperativas?.completas === true;
  const fuentesConocidas =
    liquidezLocalizada !== null && compromisosConfirmados && deudas.completas && operativasCompletas && diferencias === 0;
  const remanenteRegistrado = fuentesConocidas
    ? liquidezLocalizada - proveedores.compromisos7Dias - deudas.compromisos7Dias - obligacionesOperativas.compromisos7Dias
    : null;
  // MONYS no cuenta aún con renta, nómina, impuestos, servicios y otros costos fijos
  // confirmados para esta vista. El residual conocido no equivale a dinero libre.
  const calculable = fuentesConocidas && obligacionesOperativasConfirmadas;
  const dineroLibre = calculable ? remanenteRegistrado : null;

  let prioridad;
  if (!detalleCuentas.length) {
    prioridad = {
      nivel: "critica",
      titulo: "Registra las cuentas bancarias del negocio",
      detalle: "Sin cuentas activas MONYS no puede localizar el dinero del negocio.",
      destino: "bancos",
    };
  } else if (!bancosVigentes) {
    prioridad = {
      nivel: "critica",
      titulo: `Confirma ${cuentasPendientes.length} ${cuentasPendientes.length === 1 ? "saldo bancario" : "saldos bancarios"} de hoy`,
      detalle: "Los saldos anteriores siguen visibles para auditoría, pero no se usan como dinero disponible.",
      destino: "bancos",
    };
  } else if (!cajasCompletas) {
    prioridad = {
      nivel: "alta",
      titulo: "Carga o completa los cortes de caja de hoy",
      detalle: `${cajasFaltantes} sin corte y ${cajasIncompletas} con importes pendientes. MONYS no los convierte en cero.`,
      destino: "importador",
    };
  } else if (!proveedores.disponible) {
    prioridad = {
      nivel: "alta",
      titulo: "Carga los saldos de proveedores",
      detalle: "La liquidez puede localizarse, pero todavía no es dinero libre sin conocer las obligaciones.",
      destino: "plan",
    };
  } else if (!proveedores.vigente) {
    prioridad = {
      nivel: "alta",
      titulo: "Actualiza los saldos de proveedores",
      detalle: proveedores.antiguedadDias === null
        ? "La fecha del reporte no está confirmada."
        : `El último reporte tiene ${proveedores.antiguedadDias} días y no protege decisiones nuevas.`,
      destino: "plan",
    };
  } else if (proveedores.sinFecha > 0 || proveedores.saldosPendientes > 0) {
    prioridad = {
      nivel: "alta",
      titulo: "Confirma vencimientos de proveedores",
      detalle: `${proveedores.sinFecha} saldos no tienen fecha y ${proveedores.saldosPendientes} importes están pendientes.`,
      destino: "plan",
    };
  } else if (diferencias > 0) {
    prioridad = {
      nivel: "alta",
      titulo: "Aclara las diferencias de caja",
      detalle: `${diferencias} ${diferencias === 1 ? "caja necesita" : "cajas necesitan"} revisión antes de liberar dinero.`,
      destino: "equipo",
    };
  } else if (controlRetiros.pendientes > 0 || controlRetiros.diferencias > 0) {
    prioridad = {
      nivel: "alta",
      titulo: "Aclara el destino del efectivo retirado",
      detalle: `${controlRetiros.pendientes} retiros sin destino completo y ${controlRetiros.diferencias} con importe distinto entre SICAR y el cierre. El dinero sigue excluido para no contarlo dos veces.`,
      destino: "equipo",
    };
  } else if (comprobacionRetiros.pendientes > 0 || comprobacionRetiros.reportados > 0 || comprobacionRetiros.diferencias > 0) {
    prioridad = {
      nivel: "alta",
      titulo: "Comprueba el efectivo retirado",
      detalle: `${comprobacionRetiros.pendientes} sin evidencia, ${comprobacionRetiros.reportados} pendientes de revisión y ${comprobacionRetiros.diferencias} con diferencia. Reportado no significa comprobado.`,
      destino: "equipo",
    };
  } else if (!deudas.consultadas || deudas.incompletas > 0) {
    prioridad = {
      nivel: "alta",
      titulo: "Completa el calendario de pagos de deuda",
      detalle: !deudas.consultadas
        ? "MONYS no pudo comprobar todos los créditos activos."
        : `${deudas.incompletas} créditos tienen datos de pago incompletos${deudas.frecuenciasAmbiguas ? `; ${deudas.frecuenciasAmbiguas} usan una frecuencia distinta o dudosa frente al campo mensual` : ""}.`,
      destino: "plan",
    };
  } else if (!operativasCompletas) {
    prioridad = {
      nivel: "alta",
      titulo: "Completa los compromisos operativos",
      detalle: obligacionesOperativas?.frecuenciasNoProyectadas
        ? `${obligacionesOperativas.frecuenciasNoProyectadas} obligaciones son recurrentes y todavía no tienen su siguiente vencimiento registrado. MONYS bloquea el dinero libre hasta completar esos periodos.`
        : "Faltan obligaciones operativas guardadas o hay registros incompletos. MONYS no los convierte en cero.",
      destino: "plan",
    };
  } else if (!obligacionesOperativasConfirmadas) {
    prioridad = {
      nivel: "alta",
      titulo: "Confirma que revisaste todos los pagos próximos",
      detalle: "La cobertura diaria no está confirmada o quedó desactualizada después de registrar un cambio.",
      destino: "plan",
    };
  } else {
    prioridad = {
      nivel: dineroLibre < 0 ? "critica" : "bien",
      titulo: dineroLibre < 0 ? "Los compromisos superan la liquidez" : "Disponibilidad lista para decidir",
      detalle: dineroLibre < 0
        ? "Protege caja y reprograma pagos antes de autorizar nuevas salidas."
        : "Bancos, cajas y obligaciones próximas tienen información suficiente para decidir.",
      destino: "plan",
    };
  }

  return {
    hoy,
    cuentas: detalleCuentas,
    bancosVigentes,
    cuentasPendientes: cuentasPendientes.length,
    saldoBancos,
    cajasCompletas,
    cajasEsperadas,
    cajasFaltantes,
    cajasIncompletas,
    efectivoCajas,
    efectivoResguardado,
    fuenteCajas,
    cortesOficiales,
    controlRetiros,
    comprobacionRetiros,
    diferencias,
    proveedores,
    deudas,
    obligacionesOperativasConfirmadas,
    obligacionesOperativas,
    liquidezLocalizada,
    remanenteRegistrado,
    dineroLibre,
    calculable,
    prioridad,
  };
}
