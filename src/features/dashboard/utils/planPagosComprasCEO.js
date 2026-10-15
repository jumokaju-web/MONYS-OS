function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function fechaISO(valor) {
  const texto = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto
    ? texto
    : null;
}

function moverDias(fecha, dias) {
  const resultado = new Date(`${fecha}T12:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

function diasEntre(inicio, fin) {
  return Math.round(
    (new Date(`${fin}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86400000,
  );
}

function obligacion({ id, tipo, nombre, monto, fecha, saldo = null }) {
  return {
    id,
    tipo,
    nombre,
    monto: numeroONulo(monto),
    fecha: fechaISO(fecha),
    saldo: numeroONulo(saldo),
    origen: "REAL",
  };
}

export function construirPlanPagosCompras({
  deudas = [],
  deudasConsultadas = false,
  creditosProveedores = {},
  disponibilidad = {},
  compraMaestra = null,
  compraConsultada = false,
  hoy = disponibilidad?.hoy || new Date().toISOString().slice(0, 10),
} = {}) {
  const obligaciones = [];

  for (const credito of Array.isArray(creditosProveedores?.creditos)
    ? creditosProveedores.creditos
    : []) {
    const saldo = numeroONulo(credito?.saldo);
    if (saldo !== null && saldo <= 0) continue;
    obligaciones.push(obligacion({
      id: `proveedor-${credito?.id || credito?.numero_proveedor || obligaciones.length}`,
      tipo: "Proveedor",
      nombre: credito?.nombre || `Proveedor ${credito?.numero_proveedor || "sin nombre"}`,
      monto: saldo,
      saldo,
      fecha: credito?.fecha_vencimiento || credito?.fecha_vencimiento_estimada,
    }));
  }

  for (const deuda of Array.isArray(deudas) ? deudas : []) {
    if (!["ACTIVA", "REESTRUCTURADA"].includes(String(deuda?.estado || "").toUpperCase())) continue;
    obligaciones.push(obligacion({
      id: `credito-${deuda?.id || obligaciones.length}`,
      tipo: "Crédito",
      nombre: deuda?.acreedor || deuda?.nombre || "Crédito sin nombre",
      monto: deuda?.pago_mensual,
      saldo: deuda?.saldo_actual,
      fecha: deuda?.fecha_proximo_pago,
    }));
  }

  const incompletas = obligaciones.filter((item) => item.monto === null || item.monto <= 0 || !item.fecha);
  const programadas = obligaciones
    .filter((item) => item.monto !== null && item.monto > 0 && item.fecha)
    .map((item) => {
      const dias = diasEntre(hoy, item.fecha);
      let estado = "posterior";
      if (dias < 0) estado = "vencido";
      else if (dias <= 7) estado = "urgente";
      else if (dias <= 30) estado = "programable";
      else if (dias <= 90) estado = "horizonte";
      return { ...item, dias, estado };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const semanas = Array.from({ length: 13 }, (_, indice) => {
    const inicio = moverDias(hoy, indice * 7);
    const fin = moverDias(inicio, 6);
    const pagos = programadas.filter((item) => item.dias >= indice * 7 && item.dias <= indice * 7 + 6);
    return {
      numero: indice + 1,
      inicio,
      fin,
      pagos,
      total: pagos.reduce((suma, item) => suma + item.monto, 0),
    };
  });

  const vencidas = programadas.filter((item) => item.estado === "vencido");
  const dentro13Semanas = programadas.filter((item) => item.dias >= 0 && item.dias <= 90);
  const fuentesCompletas = deudasConsultadas === true && creditosProveedores?.fuenteCompleta === true;
  const calendarioCompleto = fuentesCompletas && incompletas.length === 0;
  const liquidez = disponibilidad?.calculable === true
    ? numeroONulo(disponibilidad?.liquidezLocalizada)
    : null;
  const inversionCompra = compraConsultada ? numeroONulo(compraMaestra?.inversionTotal) : null;

  return {
    hoy,
    obligaciones,
    incompletas,
    programadas,
    semanas,
    vencidas,
    dentro13Semanas,
    totalVencido: vencidas.reduce((suma, item) => suma + item.monto, 0),
    total7Dias: programadas
      .filter((item) => item.dias <= 7)
      .reduce((suma, item) => suma + item.monto, 0),
    total30Dias: programadas
      .filter((item) => item.dias <= 30)
      .reduce((suma, item) => suma + item.monto, 0),
    total13Semanas: [...vencidas, ...dentro13Semanas]
      .reduce((suma, item) => suma + item.monto, 0),
    fuentesCompletas,
    calendarioCompleto,
    liquidez,
    inversionCompra,
    compraLista: compraConsultada && inversionCompra !== null,
  };
}

export function simularPlanPagosCompras(plan, {
  horizonte = "7",
  incluirCompra = false,
  reserva = 0,
} = {}) {
  const reservaNumero = numeroONulo(reserva);
  if (!plan?.calendarioCompleto || plan?.liquidez === null || reservaNumero === null || reservaNumero < 0) {
    return { calculable: false, saldoFinal: null, motivo: "Faltan fuentes confirmadas o una reserva válida." };
  }

  const pagos = horizonte === "13"
    ? plan.total13Semanas
    : horizonte === "30"
      ? plan.total30Dias
      : plan.total7Dias;
  const compra = incluirCompra ? plan.inversionCompra : 0;
  if (incluirCompra && (compra === null || compra < 0)) {
    return { calculable: false, saldoFinal: null, motivo: "Falta calcular la Compra Maestra." };
  }

  const saldoFinal = plan.liquidez - pagos - (compra || 0) - reservaNumero;
  const maximoCompra = Math.max(0, plan.liquidez - pagos - reservaNumero);
  let estado = "viable";
  let recomendacion = "El escenario conserva saldo; Mónica mantiene la autorización final.";
  if (saldoFinal < 0) {
    estado = "deficit";
    recomendacion = "No autorizar así: reduce la compra o negocia fechas antes de sacar dinero.";
  } else if (saldoFinal === 0) {
    estado = "limite";
    recomendacion = "El escenario deja la caja sin margen. Protege una reserva antes de autorizar.";
  }

  return {
    calculable: true,
    liquidez: plan.liquidez,
    pagos,
    compra: compra || 0,
    reserva: reservaNumero,
    maximoCompra,
    saldoFinal,
    estado,
    recomendacion,
  };
}
