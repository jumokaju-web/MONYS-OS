const ZONA_MEXICO = "America/Mexico_City";

function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
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
  const creditos = Array.isArray(reporte?.creditos) ? reporte.creditos : [];
  let compromisos7Dias = 0;
  let sinFecha = 0;
  let saldosPendientes = 0;
  const limite = new Date(`${hoy}T12:00:00-06:00`);
  limite.setDate(limite.getDate() + 7);
  const fechaLimite = fechaMexico(limite);
  const fechaImportacion = String(reporte?.importacion?.created_at || "").slice(0, 10) || null;
  const antiguedadDias = fechaImportacion
    ? Math.max(0, Math.floor(
      (new Date(`${hoy}T12:00:00Z`).getTime() - new Date(`${fechaImportacion}T12:00:00Z`).getTime()) / 86400000
    ))
    : null;

  for (const credito of creditos) {
    const saldo = numeroONulo(credito?.saldo);
    if (saldo === null) {
      saldosPendientes += 1;
      continue;
    }
    if (saldo <= 0) continue;
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
    disponible: Boolean(reporte?.importacion),
    fechaImportacion,
    antiguedadDias,
    vigente: Boolean(reporte?.importacion) && antiguedadDias !== null && antiguedadDias <= 30,
    compromisos7Dias,
    sinFecha,
    saldosPendientes,
    total: creditos.reduce((total, credito) => total + (numeroONulo(credito?.saldo) || 0), 0),
  };
}

export function resumirDisponibilidadFinanciera({
  cuentas = [],
  cierre = {},
  cortesOficiales = {},
  creditosProveedores = {},
  hoy = fechaMexico(),
} = {}) {
  const listaCuentas = Array.isArray(cuentas) ? cuentas : [];
  const detalleCuentas = listaCuentas.map((cuenta) => {
    const saldo = numeroONulo(cuenta?.saldo);
    const fechaSaldo = fechaMexico(cuenta?.fechaActualizacion || cuenta?.fechaSaldo);
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
  const proveedores = datosProveedores(creditosProveedores, hoy);

  const liquidezLocalizada = bancosVigentes && cajasCompletas
    ? saldoBancos + (efectivoCajas || 0)
    : null;
  const compromisosConfirmados =
    proveedores.vigente && proveedores.sinFecha === 0 && proveedores.saldosPendientes === 0;
  const calculable =
    liquidezLocalizada !== null && compromisosConfirmados && diferencias === 0;
  const dineroLibre = calculable
    ? liquidezLocalizada - proveedores.compromisos7Dias
    : null;

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
    diferencias,
    proveedores,
    liquidezLocalizada,
    dineroLibre,
    calculable,
    prioridad,
  };
}
