const MARCADOR_CAJA = "MONYS_CAJA_V1";
const MARCADOR_FLOTILLA = "MONYS_FLOTILLA_V1";

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function redondear(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

export function resumirMovimientosCaja(movimientos = []) {
  const lista = Array.isArray(movimientos) ? movimientos : [];
  return lista.reduce(
    (resumen, movimiento) => {
      const monto = Math.max(0, numero(movimiento?.monto));
      if (!monto) return resumen;
      if (movimiento?.tipo === "entrada") resumen.entradas += monto;
      else resumen.salidas += monto;
      if (movimiento?.categoria === "deposito_traspaso") resumen.traspasos += monto;
      if (movimiento?.categoria === "prestamo_anticipo") resumen.prestamos += monto;
      resumen.cantidad += 1;
      return resumen;
    },
    { entradas: 0, salidas: 0, traspasos: 0, prestamos: 0, cantidad: 0 }
  );
}

function guardarBloque(marcador, datos, nota = "") {
  const textoNota = String(nota || "").trim();
  return [
    `[${marcador}]${JSON.stringify(datos)}`,
    textoNota ? `NOTA_EQUIPO: ${textoNota}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function leerBloque(texto, marcador) {
  const linea = String(texto || "")
    .split("\n")
    .find((item) => item.startsWith(`[${marcador}]`));

  if (!linea) return null;

  try {
    return JSON.parse(linea.slice(marcador.length + 2));
  } catch {
    return null;
  }
}

export function calcularCorteCaja(datos = {}) {
  const ventaSicar = numero(datos.ventaSicar);
  const efectivoVentas = numero(datos.efectivoVentas);
  const tarjeta = numero(datos.tarjeta);
  const transferencias = numero(datos.transferencias);
  const otrosCobros = numero(datos.otrosCobros);
  const fondoInicial = numero(datos.fondoInicial);
  const gastosCaja = numero(datos.gastosCaja);
  const efectivoEntregado = numero(datos.efectivoEntregado);
  const efectivoFinal = numero(datos.efectivoFinal);
  const movimientos = resumirMovimientosCaja(datos.movimientosCaja);
  const usaDetalle = movimientos.cantidad > 0;
  const entradasPosteriores = usaDetalle ? movimientos.entradas : 0;
  const salidasPosteriores = usaDetalle
    ? movimientos.salidas
    : gastosCaja + efectivoEntregado;
  const cobrado = efectivoVentas + tarjeta + transferencias + otrosCobros;
  const efectivoEsperado =
    fondoInicial + efectivoVentas + entradasPosteriores - salidasPosteriores;

  return {
    cobrado: redondear(cobrado),
    diferenciaVenta: redondear(cobrado - ventaSicar),
    efectivoEsperado: redondear(efectivoEsperado),
    diferenciaCaja: redondear(efectivoFinal - efectivoEsperado),
    entradasPosteriores: redondear(entradasPosteriores),
    salidasPosteriores: redondear(salidasPosteriores),
    traspasos: redondear(movimientos.traspasos),
    prestamos: redondear(movimientos.prestamos),
    movimientosRegistrados: movimientos.cantidad,
  };
}

export function crearObservacionesCorte(datos, nota) {
  return guardarBloque(
    MARCADOR_CAJA,
    {
      ...datos,
      ...calcularCorteCaja(datos),
      estadoRevision: "pendiente",
      capturadoEn: new Date().toISOString(),
    },
    nota
  );
}

export function leerCorteCaja(texto) {
  return leerBloque(texto, MARCADOR_CAJA);
}

export function calcularLiquidacionFlotilla(datos = {}) {
  const ingresoRuta = numero(datos.ingresoRuta);
  const pagoChofer = numero(datos.pagoChofer);
  const sacarCamioneta = numero(datos.sacarCamioneta);
  const gasolina = numero(datos.gasolina);
  const casetas = numero(datos.casetas);
  const mantenimiento = numero(datos.mantenimiento);
  const prestamos = numero(datos.prestamos);
  const otrosGastos = numero(datos.otrosGastos);
  const gastos =
    pagoChofer +
    sacarCamioneta +
    gasolina +
    casetas +
    mantenimiento +
    prestamos +
    otrosGastos;

  return {
    gastos: redondear(gastos),
    resultadoEstimado: redondear(ingresoRuta - gastos),
  };
}

export function crearObservacionesFlotilla(datos, nota) {
  return guardarBloque(
    MARCADOR_FLOTILLA,
    {
      ...datos,
      ...calcularLiquidacionFlotilla(datos),
      estadoRevision: "pendiente",
      capturadoEn: new Date().toISOString(),
    },
    nota
  );
}

export function leerLiquidacionFlotilla(texto) {
  return leerBloque(texto, MARCADOR_FLOTILLA);
}

export function extraerCapturaFinanciera(cierre) {
  const corte = leerCorteCaja(cierre?.observaciones);
  if (corte) return { tipo: "caja", datos: corte, cierre };

  const flotilla = leerLiquidacionFlotilla(cierre?.observaciones);
  if (flotilla) return { tipo: "flotilla", datos: flotilla, cierre };

  return null;
}
