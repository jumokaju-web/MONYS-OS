function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function dinero(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

export function calcularPagoRuta(kilometros, tipoPago = "MLP") {
  const km = Math.max(0, numero(kilometros));
  if (tipoPago === "RENTAL_SMALL") return { base: 1100, bono: 0, total: 1100 };
  if (tipoPago === "RENTAL_LARGE") return { base: 1221, bono: 0, total: 1221 };
  if (km < 100) return { base: 1600, bono: 0, total: 1600 };
  if (km <= 154) return { base: 1600, bono: 150, total: 1750 };
  if (km <= 200) return { base: 1600, bono: 300, total: 1900 };
  return { base: 1600, bono: 425, total: 2025 };
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

  const gasolina = lista.filter((item) => item.tipo === "GASOLINA" && item.estado !== "RECHAZADO").reduce((total, item) => total + numero(item.importe), 0);
  const adelantosSolicitados = lista.filter((item) => item.tipo === "ADELANTO" && item.estado === "SOLICITADO").reduce((total, item) => total + numero(item.importe), 0);
  const adelantosEntregados = lista.filter((item) => item.tipo === "ADELANTO" && item.estado === "ENTREGADO").reduce((total, item) => total + numero(item.importe), 0);
  const ambulanciasConfirmadas = lista.filter((item) => item.tipo === "AMBULANCIA" && item.estado === "CONFIRMADO").reduce((total, item) => total + numero(item.importe), 0);
  const otrosConfirmados = lista.filter((item) => item.tipo === "OTRO" && item.estado === "CONFIRMADO").reduce((total, item) => total + numero(item.importe), 0);
  const ganado = dinero(pago.total + ambulanciasConfirmadas + otrosConfirmados);

  return {
    kilometros,
    pagoBase: pago.base,
    bonoKilometraje: pago.bono,
    gasolina: dinero(gasolina),
    adelantosSolicitados: dinero(adelantosSolicitados),
    adelantosEntregados: dinero(adelantosEntregados),
    ambulanciasConfirmadas: dinero(ambulanciasConfirmadas),
    otrosConfirmados: dinero(otrosConfirmados),
    ganado,
    saldoEstimado: dinero(ganado - adelantosEntregados),
  };
}

export function calcularRepartoRental(operaciones = [], corte = {}) {
  const rentals = (Array.isArray(operaciones) ? operaciones : []).filter((item) =>
    ["RENTAL_SMALL", "RENTAL_LARGE"].includes(item?.tipo_pago || item?.unidad?.tipo_pago_chory)
  );
  const ingreso = dinero(corte.ingreso);
  const pagoChoferes = dinero(rentals.reduce((total, item) => total + numero(item?.resumen?.ganado), 0));
  const gasolina = dinero(rentals.reduce((total, item) => total + numero(item?.resumen?.gasolina), 0));
  const otroGasto = dinero(corte.otro_importe);
  const utilidadNeta = dinero(ingreso - pagoChoferes - gasolina - otroGasto);
  const utilidadRepartible = Math.max(0, utilidadNeta);

  return {
    rutas: rentals.length,
    ingreso,
    pagoChoferes,
    gasolina,
    otroConcepto: String(corte.otro_concepto || "").trim(),
    otroGasto,
    utilidadNeta,
    hayPerdida: utilidadNeta < 0,
    utilidadRepartible,
    partePorSocio: dinero(utilidadRepartible / 3),
    socios: ["Abraham", "Chory", "Kary"],
  };
}
