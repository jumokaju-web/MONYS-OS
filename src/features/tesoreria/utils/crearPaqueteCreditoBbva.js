const IMPORTE = String.raw`\$?\s*([\d,]+\.\d{2})`;

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function importe(texto, etiqueta, patron) {
  const resultado = texto.match(patron);
  if (!resultado) throw new Error(`Falta “${etiqueta}” en el estado del crédito BBVA.`);
  const valor = Number(resultado[1].replaceAll(",", ""));
  if (!Number.isFinite(valor)) throw new Error(`No pude leer “${etiqueta}” en el estado del crédito BBVA.`);
  return Math.round(valor * 100);
}

function fechaISO(fecha, etiqueta) {
  const resultado = fecha.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!resultado) throw new Error(`No pude leer la fecha de ${etiqueta} en el estado del crédito BBVA.`);
  const [, dia, mes, anio] = resultado;
  const iso = `20${anio}-${mes}-${dia}`;
  const valida = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(valida.getTime()) || valida.toISOString().slice(0, 10) !== iso) {
    throw new Error(`La fecha de ${etiqueta} no es válida.`);
  }
  return iso;
}

function formato(centavos) {
  return (centavos / 100).toFixed(2);
}

/** Lee el resumen mensual BBVA Línea Crédito Digital PyME, sin modificar saldos. */
export function crearPaqueteCreditoBbva(contenido) {
  const texto = normalizar(Array.isArray(contenido)
    ? contenido.map((linea) => linea?.texto || "").join("\n")
    : contenido);
  if (!texto.includes("BBVA") || !texto.includes("LINEA CREDITO DIGITAL PYME")) {
    throw new Error("El PDF no parece ser un estado BBVA de Línea Crédito Digital PyME.");
  }

  const numeroCredito = texto.match(/NO\.\s*DE\s*CREDITO\s+([\d ]{16,20})/);
  const inicioDomicilio = texto.indexOf("FRANCISCO I MADERO");
  const nombreAntesDomicilio = inicioDomicilio >= 0
    ? texto.slice(Math.max(0, inicioDomicilio - 70), inicioDomicilio).match(/([A-Z]+(?:\s+[A-Z]+){2,3})\s*$/)
    : null;
  const fechaCorte = texto.match(/FECHA DE CORTE\s+(\d{2}\/\d{2}\/\d{2})/);
  const fechaLimite = texto.match(/FECHA LIMITE DE PAGO\s+(\d{2}\/\d{2}\/\d{2})/);
  if (!numeroCredito || !fechaCorte || !fechaLimite) {
    throw new Error("Faltan número de crédito o fechas del resumen BBVA; no se preparó la revisión.");
  }

  const credito = numeroCredito[1].replace(/\s/g, "");
  const saldoCorte = importe(texto, "Saldo al Corte", new RegExp(`SALDO AL CORTE\\s*\\+?${IMPORTE}`));
  const saldoPromociones = importe(texto, "Saldo Actual de promociones", new RegExp(`SUBTOTAL SALDO ACTUAL[\\s\\S]{0,80}?${IMPORTE}`));
  const limite = importe(texto, "Límite de Crédito", new RegExp(`LIMITE DE CREDITO\\s*${IMPORTE}`));
  const disponible = importe(texto, "Crédito Disponible", new RegExp(`CREDITO DISPONIBLE\\s*${IMPORTE}`));
  const pagoMinimo = importe(texto, "Pago Mínimo", new RegExp(`PAGO MINIMO\\s*${IMPORTE}`));
  const pagoNoIntereses = importe(texto, "Pago para no generar intereses", new RegExp(`PAGO PARA NO GENERAR INTERESES:?\\s*${IMPORTE}`));
  const saldoInicial = importe(texto, "Saldo Inicial del Periodo", new RegExp(`SALDO INICIAL DEL PERIODO\\s*\\+?${IMPORTE}`));
  const pagos = importe(texto, "Pagos del periodo", new RegExp(`PAGOS:\\s*-?${IMPORTE}`));
  const capitalPago = importe(texto, "Capital abonado en el último pago", new RegExp(`CAPITAL\\s*:${IMPORTE}`));
  const interesesPago = importe(texto, "Intereses del último pago", new RegExp(`INTERES\\s*:${IMPORTE}`));
  const comisionesPago = importe(texto, "Comisiones del último pago", new RegExp(`COMISIONES\\s*:${IMPORTE}`));
  const ivaPago = importe(texto, "IVA del último pago", new RegExp(`IVA\\s*:${IMPORTE}`));
  const inicioBloquePago = texto.indexOf("PAGO PARA NO GENERAR INTERESES");
  const finBloquePago = texto.indexOf("MONTO DE CARGOS OBJETADOS NO EXIGIBLES", inicioBloquePago);
  const bloquePago = texto.slice(inicioBloquePago, finBloquePago < 0 ? undefined : finBloquePago);
  const pagoCapitalMinimo = importe(bloquePago, "Capital del pago mínimo", new RegExp(`CAPITAL\\s+${IMPORTE}`));
  const pagoInteresesMinimo = importe(bloquePago, "Intereses del pago mínimo", new RegExp(`INTERESES\\s+${IMPORTE}`));
  const pagoIvaMinimo = importe(bloquePago, "IVA del pago mínimo", new RegExp(`IVA\\s+${IMPORTE}`));
  if (capitalPago + interesesPago + comisionesPago + ivaPago !== pagos) {
    throw new Error("El desglose del último pago BBVA no cuadra con el total pagado.");
  }
  if (pagoCapitalMinimo + pagoInteresesMinimo + pagoIvaMinimo !== pagoMinimo || pagoMinimo !== pagoNoIntereses) {
    throw new Error("El desglose del pago mínimo no cuadra con el resumen BBVA.");
  }
  if (saldoCorte - saldoPromociones !== pagoMinimo) {
    throw new Error("Saldo al corte y saldo de promociones no concilian con el pago mínimo; se requiere revisar el PDF.");
  }
  if (saldoCorte + disponible !== limite || pagoMinimo > saldoCorte) {
    throw new Error("Límite, disponible y saldo del crédito no concilian con el resumen BBVA.");
  }

  const corte = fechaISO(fechaCorte[1], "corte");
  const limitePago = fechaISO(fechaLimite[1], "límite de pago");
  if (limitePago <= corte) throw new Error("La fecha límite de pago debe ser posterior a la fecha de corte.");
  const propietario = nombreAntesDomicilio?.[1]?.trim().replace(/\s+/g, " ") || "";
  const tasaAnual = Number((texto.match(/TASA DEL PRODUCTO\s+([\d.]+)\s*%/) || [])[1]);
  if (!propietario || !Number.isFinite(tasaAnual)) {
    throw new Error("No pude identificar con seguridad el titular o la tasa del crédito.");
  }

  return {
    version: 1,
    producto: "Línea Crédito Digital PyME",
    acreedor: "BBVA",
    numeroCredito: credito,
    terminacion: credito.slice(-4),
    titular: propietario,
    corte,
    fechaLimitePago: limitePago,
    moneda: "MXN",
    saldoAlCorte: formato(saldoCorte),
    saldoPromociones: formato(saldoPromociones),
    limiteCredito: formato(limite),
    creditoDisponibleAlCorte: formato(disponible),
    saldoInicialPeriodo: formato(saldoInicial),
    pagoMinimo: formato(pagoMinimo),
    pagoParaNoGenerarIntereses: formato(pagoNoIntereses),
    ultimoPago: {
      total: formato(pagos),
      capital: formato(capitalPago),
      intereses: formato(interesesPago),
      comisiones: formato(comisionesPago),
      iva: formato(ivaPago),
    },
    tasaAnualProducto: tasaAnual,
    advertencia: "El saldo corresponde a la fecha de corte del estado. No confirma el saldo actual ni que el pago mínimo siga pendiente.",
  };
}
