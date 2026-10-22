export function importePlaneado(valor) {
  if ((typeof valor === 'string' && valor.trim() === '') || valor === null || valor === undefined || typeof valor === 'boolean') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export const CAMPOS_PAGOS_FLUJO = [
  "nomina",
  "proveedores",
  "rentaServicios",
  "impuestos",
  "creditos",
  "tandaPago",
  "otrosPagos",
];

export function sumarImportesPlaneados(valores = []) {
  const importes = valores.map(importePlaneado);
  if (importes.some((importe) => importe === null)) return null;
  return Math.round(importes.reduce((total, importe) => total + importe, 0) * 100) / 100;
}

function fechaISOValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""))) return null;
  const fecha = new Date(`${valor}T12:00:00Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function inicioSemana(fecha, inicio) {
  const dias = Math.floor((fecha.getTime() - inicio.getTime()) / 86400000);
  return dias < 0 ? null : Math.floor(dias / 7);
}

export function construirCalendarioTanda({
  inicioFlujo,
  inicioTanda,
  semanasTanda,
  aportacionSemanal,
  numerosPropios,
  cobros = [],
  montoPorCobro,
} = {}) {
  const fechaFlujo = fechaISOValida(inicioFlujo);
  const fechaTanda = fechaISOValida(inicioTanda);
  const totalSemanas = Number(semanasTanda);
  const aporte = importePlaneado(aportacionSemanal);
  const numeros = Number(numerosPropios);
  const montoCobro = importePlaneado(montoPorCobro);

  if (!fechaFlujo || !fechaTanda || !Number.isInteger(totalSemanas) || totalSemanas <= 0 || aporte === null || !Number.isInteger(numeros) || numeros <= 0) {
    return { valido: false, semanas: [], error: "Completa fechas, semanas, aportación y números propios con valores válidos." };
  }

  const semanas = Array.from({ length: 13 }, () => ({ tandaPago: 0, tandaCobro: 0 }));
  const pagoSemanal = Math.round(aporte * numeros * 100) / 100;

  for (let indice = 0; indice < totalSemanas; indice += 1) {
    const fechaPago = new Date(fechaTanda);
    fechaPago.setUTCDate(fechaPago.getUTCDate() + indice * 7);
    const semanaFlujo = inicioSemana(fechaPago, fechaFlujo);
    if (semanaFlujo !== null && semanaFlujo < 13) semanas[semanaFlujo].tandaPago += pagoSemanal;
  }

  const fechasCobroInvalidas = [];
  cobros.filter(Boolean).forEach((valor) => {
    const fechaCobro = fechaISOValida(valor);
    if (!fechaCobro || montoCobro === null) {
      fechasCobroInvalidas.push(valor);
      return;
    }
    const semanaFlujo = inicioSemana(fechaCobro, fechaFlujo);
    if (semanaFlujo !== null && semanaFlujo < 13) semanas[semanaFlujo].tandaCobro += montoCobro;
  });

  return {
    valido: fechasCobroInvalidas.length === 0,
    semanas,
    pagoSemanal,
    aportacionTotal: Math.round(pagoSemanal * totalSemanas * 100) / 100,
    cobroTotal: montoCobro === null ? null : Math.round(montoCobro * cobros.filter(Boolean).length * 100) / 100,
    error: fechasCobroInvalidas.length ? "Revisa las fechas y el monto de los cobros de la tanda." : null,
  };
}

export function calcularFlujo13Semanas({ saldoInicial, semanas = [] }) {
  let saldo = importePlaneado(saldoInicial);
  return Array.from({ length: 13 }, (_, i) => {
    const semana = semanas[i] || {};
    const cobrosOperativos = importePlaneado(semana.cobros);
    const tandaCobro = importePlaneado(semana.tandaCobro ?? 0);
    const usaDesglose = CAMPOS_PAGOS_FLUJO.some((campo) => semana[campo] !== undefined);
    const pagos = usaDesglose
      ? sumarImportesPlaneados(CAMPOS_PAGOS_FLUJO.map((campo) => semana[campo]))
      : importePlaneado(semana.pagos);
    const cobros = cobrosOperativos === null || tandaCobro === null
      ? null
      : Math.round((cobrosOperativos + tandaCobro) * 100) / 100;
    const inicio = saldo;
    const completa = inicio !== null && cobros !== null && pagos !== null;
    saldo = completa ? Math.round((inicio + cobros - pagos) * 100) / 100 : null;
    return { semana: i + 1, inicio, cobros, cobrosOperativos, tandaCobro, pagos, saldo, completa, deficit: saldo !== null && saldo < 0 };
  });
}
