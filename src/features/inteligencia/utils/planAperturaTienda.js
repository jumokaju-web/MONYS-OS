const GASTOS_MENSUALES_APERTURA = 33000 + (10000 * 52) / 12 + 2000 + 300 + 800 + 2000;

function mesEnMexico(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(fecha);
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}`;
}

function diasDelMes(mes) {
  const [anio, numeroMes] = String(mes).split("-").map(Number);
  if (!anio || !numeroMes) return 30;
  return new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();
}

function escenario(nombre, mes, deuda, metaDiaria) {
  const diasAbiertos = diasDelMes(mes);
  return {
    nombre,
    mes,
    datos: {
      gastosFijos: GASTOS_MENSUALES_APERTURA.toFixed(2),
      margenBruto: "40",
      variablePorcentaje: "4",
      diasAbiertos: String(diasAbiertos),
      deuda: String(deuda),
      ventaPrevista: String(metaDiaria * diasAbiertos),
    },
  };
}

export function crearPlanAperturaTienda(fecha = new Date()) {
  const mes = mesEnMexico(fecha);
  return [
    escenario("Arranque · liquidar hermano", mes, 25000, 11500),
    escenario("Acelerar deuda de papá", mes, 21667, 10500),
    escenario("Operación estable", mes, 0, 9000),
  ];
}

export { GASTOS_MENSUALES_APERTURA };
