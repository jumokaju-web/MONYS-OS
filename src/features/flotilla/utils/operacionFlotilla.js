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
  const ingresoPorTarifa = dinero(rentals.reduce((total, item) => total + numero(
    item?.resumen?.ingresoRental ?? calcularPagoRuta(0, item?.tipo_pago || item?.unidad?.tipo_pago_chory).cobroEmpresa
  ), 0));
  const ingresoRegistrado = dinero(corte.ingreso);
  const ingreso = ingresoRegistrado > 0 ? ingresoRegistrado : ingresoPorTarifa;
  const pagoChoferes = dinero(rentals.reduce((total, item) => total
    + numero(item?.resumen?.pagoBase)
    + numero(item?.resumen?.otrosConfirmados), 0));
  const gasolinaEmpresa = dinero(rentals.reduce((total, item) => total + numero(item?.resumen?.gasolinaEmpresa), 0));
  const gasolinaChofer = dinero(rentals.reduce((total, item) => total + numero(item?.resumen?.gasolinaChofer), 0));
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
    ingreso,
    ingresoPorTarifa,
    ingresoRegistrado,
    origenIngreso: ingresoRegistrado > 0 ? "REGISTRADO" : "TARIFAS",
    pagoChoferes,
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
