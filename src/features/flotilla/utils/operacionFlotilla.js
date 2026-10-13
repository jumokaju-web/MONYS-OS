function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function dinero(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

export function calcularPagoRuta(kilometros, tipoPago = "MLP") {
  const km = Math.max(0, numero(kilometros));
  if (tipoPago === "RENTAL_SMALL") return { base: 850, bono: 0, total: 850, cobroEmpresa: 1100 };
  if (tipoPago === "RENTAL_LARGE") return { base: 1000, bono: 0, total: 1000, cobroEmpresa: 1221 };
  if (km <= 100) return { base: 1600, bono: 0, total: 1600, cobroEmpresa: 0 };
  if (km <= 150) return { base: 1600, bono: 150, total: 1750, cobroEmpresa: 0 };
  if (km <= 200) return { base: 1600, bono: 300, total: 1900, cobroEmpresa: 0 };
  if (km <= 250) return { base: 1600, bono: 425, total: 2025, cobroEmpresa: 0 };
  return { base: 1600, bono: 500, total: 2100, cobroEmpresa: 0 };
}

export function calcularAmbulancia(paradas, pagoRuta) {
  const totalParadas = Math.max(0, Math.floor(numero(paradas)));
  if (totalParadas === 0) return 0;
  if (totalParadas <= 15) return 200;
  if (totalParadas <= 30) return 320;
  return dinero(numero(pagoRuta) * 0.5);
}

function tieneTexto(valor) {
  return String(valor ?? "").trim().length > 0;
}

export const MOTIVOS_RECHAZO_EVIDENCIA = [
  "Foto borrosa",
  "Kilometraje ilegible",
  "Nivel de gasolina no visible",
  "Ticket incompleto o ilegible",
  "Foto equivocada",
];

function agregarRechazo(faltantes, etiqueta, revision) {
  if (revision?.estado !== "RECHAZADA") return false;
  faltantes.push(`${etiqueta} rechazada: ${revision.motivo || "debe repetirse"}`);
  return true;
}

export function revisarEvidenciaRuta(operacion = {}, movimientos = []) {
  const faltantes = [];
  const lista = Array.isArray(movimientos) ? movimientos : [];
  const finalizada = operacion.estado === "FINALIZADA" || Boolean(operacion.hora_fin_ruta);

  if (numero(operacion.km_inicial) <= 0) faltantes.push("Kilometraje inicial");
  if (!tieneTexto(operacion.gasolina_in)) faltantes.push("Gasolina inicial");
  const salidaRechazada = agregarRechazo(faltantes, "Foto del tablero al salir", operacion.revision_foto_salida);
  if (!salidaRechazada && !tieneTexto(operacion.foto_salida_url || operacion.foto_salida_path)) faltantes.push("Foto del tablero al salir");

  if (finalizada) {
    const kmInicial = numero(operacion.km_inicial);
    const kmFinal = numero(operacion.km_final);
    if (kmFinal <= 0 || (kmInicial > 0 && kmFinal < kmInicial)) faltantes.push("Kilometraje final válido");
    if (!tieneTexto(operacion.gasolina_out)) faltantes.push("Gasolina final");
    const cierreRechazado = agregarRechazo(faltantes, "Foto del tablero al regresar", operacion.revision_foto_cierre);
    if (!cierreRechazado && !tieneTexto(operacion.foto_cierre_url || operacion.foto_cierre_path)) faltantes.push("Foto del tablero al regresar");
  }

  lista.forEach((movimiento, indice) => {
    if (movimiento?.estado === "RECHAZADO") return;
    if (movimiento?.tipo === "GASOLINA") {
      const etiqueta = `Carga de gasolina ${indice + 1}`;
      if (numero(movimiento.importe) <= 0) faltantes.push(`${etiqueta}: importe`);
      if (numero(movimiento.litros) <= 0) faltantes.push(`${etiqueta}: litros`);
      if (!tieneTexto(movimiento.pagador)) faltantes.push(`${etiqueta}: quién pagó`);
      const ticketRechazado = agregarRechazo(faltantes, `${etiqueta}: foto del ticket`, movimiento.revision_evidencia);
      if (!ticketRechazado && !tieneTexto(movimiento.evidencia_url || movimiento.evidencia_path)) faltantes.push(`${etiqueta}: foto del ticket`);
    }
    if (movimiento?.tipo === "AMBULANCIA") {
      const ambulanciaRechazada = agregarRechazo(faltantes, "Ambulancia: evidencia del apoyo", movimiento.revision_evidencia);
      if (!ambulanciaRechazada && !tieneTexto(movimiento.evidencia_url || movimiento.evidencia_path)) {
        faltantes.push("Ambulancia: evidencia del apoyo");
      }
    }
  });

  return {
    estado: faltantes.length > 0 ? "PENDIENTE" : finalizada ? "COMPLETA" : "EN_CURSO",
    faltantes,
    totalFaltantes: faltantes.length,
    finalizada,
  };
}

export function resumirOperacionFlotilla(operacion = {}, movimientos = []) {
  const kmInicial = numero(operacion.km_inicial);
  const kmFinal = numero(operacion.km_final);
  const kilometrosRegistrados = numero(operacion.kilometros_ruta);
  const kilometros = kilometrosRegistrados > 0
    ? dinero(kilometrosRegistrados)
    : kmFinal >= kmInicial && kmInicial > 0 ? dinero(kmFinal - kmInicial) : 0;
  const pago = calcularPagoRuta(
    kilometros,
    operacion.tipo_pago || operacion.unidad?.tipo_pago_chory || "MLP"
  );
  const lista = Array.isArray(movimientos) ? movimientos : [];
  const esRental = ["RENTAL_SMALL", "RENTAL_LARGE"].includes(
    operacion.tipo_pago || operacion.unidad?.tipo_pago_chory
  );

  const gasolina = lista.filter((item) => item.tipo === "GASOLINA" && item.estado !== "RECHAZADO").reduce((total, item) => total + numero(item.importe), 0);
  const gasolinaEmpresa = lista.filter((item) => item.tipo === "GASOLINA" && item.estado !== "RECHAZADO" && String(item.pagador || "").toUpperCase() === "EMPRESA").reduce((total, item) => total + numero(item.importe), 0);
  const gasolinaChofer = lista.filter((item) => item.tipo === "GASOLINA" && item.estado !== "RECHAZADO" && (String(item.pagador || "").toUpperCase() === "CHOFER" || (esRental && !item.pagador))).reduce((total, item) => total + numero(item.importe), 0);
  const adelantosSolicitados = lista.filter((item) => item.tipo === "ADELANTO" && item.estado === "SOLICITADO").reduce((total, item) => total + numero(item.importe), 0);
  const adelantosEntregados = lista.filter((item) => item.tipo === "ADELANTO" && item.estado === "ENTREGADO").reduce((total, item) => total + numero(item.importe), 0);
  const ambulanciasConfirmadas = lista.filter((item) => item.tipo === "AMBULANCIA" && item.estado === "CONFIRMADO").reduce((total, item) => total + numero(item.importe), 0);
  const ambulanciasDescontadas = lista.filter((item) => item.tipo === "AMBULANCIA_DESCUENTO" && item.estado === "CONFIRMADO").reduce((total, item) => total + numero(item.importe), 0);
  const otrosConfirmados = lista.filter((item) => item.tipo === "OTRO" && item.estado === "CONFIRMADO").reduce((total, item) => total + numero(item.importe), 0);
  const ganado = dinero(pago.total + ambulanciasConfirmadas + otrosConfirmados - ambulanciasDescontadas);

  return {
    kilometros,
    pagoBase: pago.base,
    bonoKilometraje: pago.bono,
    ingresoRental: dinero(pago.cobroEmpresa),
    gasolina: dinero(gasolina),
    gasolinaEmpresa: dinero(gasolinaEmpresa),
    gasolinaChofer: dinero(gasolinaChofer),
    adelantosSolicitados: dinero(adelantosSolicitados),
    adelantosEntregados: dinero(adelantosEntregados),
    ambulanciasConfirmadas: dinero(ambulanciasConfirmadas),
    ambulanciasDescontadas: dinero(ambulanciasDescontadas),
    otrosConfirmados: dinero(otrosConfirmados),
    ganado,
    saldoEstimado: dinero(ganado - adelantosEntregados),
  };
}

export function calcularRepartoRental(operaciones = [], corte = {}) {
  const rentals = (Array.isArray(operaciones) ? operaciones : []).filter((item) =>
    ["RENTAL_SMALL", "RENTAL_LARGE"].includes(item?.tipo_pago || item?.unidad?.tipo_pago_chory)
  );
  const detalleRutas = rentals.map((item) => {
    const tipo = item?.tipo_pago || item?.unidad?.tipo_pago_chory;
    const tarifa = calcularPagoRuta(0, tipo);
    const resumen = item?.resumen || {};
    const ingreso = dinero(resumen.ingresoRental ?? tarifa.cobroEmpresa);
    const pagoChofer = dinero(resumen.ganado ?? tarifa.total);
    const adelantos = dinero(resumen.adelantosEntregados);
    const gasolinaEmpresa = dinero(resumen.gasolinaEmpresa);
    const gasolinaChofer = dinero(resumen.gasolinaChofer);
    return {
      id: item?.id,
      tipo,
      etiquetaTipo: tipo === "RENTAL_LARGE" ? "Large" : "Small",
      chofer: item?.chofer_nombre || "Chofer sin nombre",
      placas: item?.unidad?.placas || "Sin placas",
      codigoRuta: item?.codigo_ruta || "Ruta pendiente",
      ingreso,
      pagoChofer,
      adelantos,
      saldoChofer: dinero(pagoChofer - adelantos),
      gasolinaEmpresa,
      gasolinaChofer,
      ambulanciasFavor: dinero(resumen.ambulanciasConfirmadas),
      ambulanciasDescuento: dinero(resumen.ambulanciasDescontadas),
      utilidadRuta: dinero(ingreso - pagoChofer - gasolinaEmpresa),
    };
  });
  const ingresoPorTarifa = dinero(detalleRutas.reduce((total, item) => total + item.ingreso, 0));
  const ingresoRegistrado = dinero(corte.ingreso);
  const ingreso = ingresoRegistrado > 0 ? ingresoRegistrado : ingresoPorTarifa;
  const pagoChoferes = dinero(detalleRutas.reduce((total, item) => total + item.pagoChofer, 0));
  const adelantosEntregados = dinero(detalleRutas.reduce((total, item) => total + item.adelantos, 0));
  const saldoChoferes = dinero(detalleRutas.reduce((total, item) => total + item.saldoChofer, 0));
  const gasolinaEmpresa = dinero(detalleRutas.reduce((total, item) => total + item.gasolinaEmpresa, 0));
  const gasolinaChofer = dinero(detalleRutas.reduce((total, item) => total + item.gasolinaChofer, 0));
  const otroGasto = dinero(corte.otro_importe);
  const utilidadNeta = dinero(ingreso - pagoChoferes - gasolinaEmpresa - otroGasto);
  const utilidadRepartible = Math.max(0, utilidadNeta);
  const parteBase = Math.floor((utilidadRepartible * 100) / 3) / 100;
  const repartoSocios = {
    Abraham: parteBase,
    Chory: parteBase,
    Kary: dinero(utilidadRepartible - parteBase - parteBase),
  };

  return {
    rutas: rentals.length,
    rutasSmall: detalleRutas.filter((item) => item.tipo === "RENTAL_SMALL").length,
    rutasLarge: detalleRutas.filter((item) => item.tipo === "RENTAL_LARGE").length,
    detalleRutas,
    ingreso,
    ingresoPorTarifa,
    ingresoRegistrado,
    ajusteIngreso: dinero(ingreso - ingresoPorTarifa),
    origenIngreso: ingresoRegistrado > 0 ? "REGISTRADO" : "TARIFAS",
    pagoChoferes,
    adelantosEntregados,
    saldoChoferes,
    gasolina: gasolinaEmpresa,
    gasolinaEmpresa,
    gasolinaChofer,
    otroConcepto: String(corte.otro_concepto || "").trim(),
    otroGasto,
    utilidadNeta,
    hayPerdida: utilidadNeta < 0,
    utilidadRepartible,
    partePorSocio: parteBase,
    repartoSocios,
    socios: ["Abraham", "Chory", "Kary"],
  };
}
