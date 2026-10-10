const MARCADOR_CAJA = "MONYS_CAJA_V1";
const MARCADOR_FLOTILLA = "MONYS_FLOTILLA_V1";

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function redondear(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
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
  const cobrado = efectivoVentas + tarjeta + transferencias + otrosCobros;
  const efectivoEsperado =
    fondoInicial + efectivoVentas - gastosCaja - efectivoEntregado;

  return {
    cobrado: redondear(cobrado),
    diferenciaVenta: redondear(cobrado - ventaSicar),
    efectivoEsperado: redondear(efectivoEsperado),
    diferenciaCaja: redondear(efectivoFinal - efectivoEsperado),
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
