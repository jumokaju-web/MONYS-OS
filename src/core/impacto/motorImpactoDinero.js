/*
 * MOTOR DE IMPACTO EN DINERO · MONYS OS
 *
 * Un solo criterio para responder "¿cuánto gano o ahorro si hago esto?"
 * en traspasos, compras de temporada, campañas y pagos de deuda.
 *
 * Reglas del producto (docs/PRODUCTO_MONYS_OS.md):
 * - Ausente no significa cero: si falta un dato, el resultado queda en
 *   estado "faltan_datos" y dice qué falta; nunca se inventa un 0.
 * - Estimado no significa real: todo resultado es "estimado" y trae sus
 *   supuestos para que la persona pueda revisarlos.
 * - Recomendado no significa autorizado: las compras sin liquidez
 *   comprobada quedan en "requiere_liquidez".
 *
 * Distinguimos dos cosas que no deben sumarse como si fueran lo mismo:
 * - ganancia: utilidad adicional esperada (lo que mejora el resultado).
 * - ahorro: efectivo que no sale de caja (mejora liquidez, no utilidad).
 *
 * Módulo puro: no consulta Supabase ni depende de React.
 */

export const ESTADOS_IMPACTO = Object.freeze({
  ESTIMADO: "estimado",
  FALTAN_DATOS: "faltan_datos",
  REQUIERE_LIQUIDEZ: "requiere_liquidez",
  NO_CONVIENE: "no_conviene",
});

const DIAS_HORIZONTE_TRASPASO = 14;
const FACTOR_REMATE_PREDETERMINADO = 0.5;

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function redondear(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

function faltan(tipo, faltantes, extra = {}) {
  return {
    tipo,
    estado: ESTADOS_IMPACTO.FALTAN_DATOS,
    ganancia: null,
    ahorro: null,
    faltantes,
    supuestos: [],
    ...extra,
  };
}

function clavePorCodigo(codigo) {
  const limpio = String(codigo ?? "").trim().toLowerCase();
  return limpio ? `codigo:${limpio}` : "";
}

/*
 * Resume margen por producto desde filas de "Ventas por artículo" de SICAR.
 * Usa totales (importe y utilidad entre piezas) para no depender de si la
 * columna "costo" del reporte es unitaria o total.
 */
export function resumirMargenesPorProducto(ventas = []) {
  const acumulado = new Map();

  for (const venta of ventas || []) {
    const clave = clavePorCodigo(venta?.codigo);
    const piezas = numero(venta?.cantidad);
    if (!clave || !piezas || piezas <= 0) continue;

    const registro = acumulado.get(clave) || {
      piezas: 0,
      importe: 0,
      utilidad: 0,
      filasConUtilidad: 0,
      filasConImporte: 0,
    };

    registro.piezas += piezas;
    const importe = numero(venta?.importe);
    const utilidad = numero(venta?.utilidad);
    if (importe !== null) {
      registro.importe += importe;
      registro.filasConImporte += 1;
    }
    if (utilidad !== null) {
      registro.utilidad += utilidad;
      registro.filasConUtilidad += 1;
    }
    acumulado.set(clave, registro);
  }

  const margenes = new Map();
  for (const [clave, registro] of acumulado) {
    const conImporte = registro.filasConImporte > 0 && registro.importe > 0;
    // Utilidad en cero con importe positivo suele ser columna ausente, no margen real.
    const conUtilidad = registro.filasConUtilidad > 0 && registro.utilidad !== 0;
    const precioPromedio = conImporte ? registro.importe / registro.piezas : null;
    const utilidadUnitaria = conUtilidad ? registro.utilidad / registro.piezas : null;

    margenes.set(clave, {
      piezas: registro.piezas,
      precioPromedio: precioPromedio === null ? null : redondear(precioPromedio),
      utilidadUnitaria: utilidadUnitaria === null ? null : redondear(utilidadUnitaria),
      costoUnitario:
        precioPromedio !== null && utilidadUnitaria !== null
          ? redondear(precioPromedio - utilidadUnitaria)
          : null,
      margen:
        precioPromedio && utilidadUnitaria !== null
          ? Math.round((utilidadUnitaria / precioPromedio) * 1000) / 1000
          : null,
    });
  }

  return margenes;
}

/*
 * Traspaso entre sucursales.
 * ganancia = piezas que el destino puede vender en el horizonte × utilidad
 *            por pieza − costo del traslado.
 * ahorro   = lo que costaría comprar esas piezas nuevas para el destino.
 */
export function calcularImpactoTraspaso({
  cantidad,
  utilidadUnitaria,
  costoUnitario = null,
  ventaDiariaDestino,
  diasHorizonte = DIAS_HORIZONTE_TRASPASO,
  costoTraslado = 0,
} = {}) {
  const piezas = numero(cantidad);
  const utilidad = numero(utilidadUnitaria);
  const ritmo = numero(ventaDiariaDestino);
  const traslado = numero(costoTraslado) ?? 0;
  const costo = numero(costoUnitario);

  const faltantes = [];
  if (!piezas || piezas <= 0) faltantes.push("piezas a traspasar");
  if (utilidad === null) faltantes.push("utilidad por pieza (reporte Ventas por artículo con utilidad)");
  if (ritmo === null) faltantes.push("venta diaria de la sucursal destino");
  if (faltantes.length) return faltan("traspaso", faltantes);

  const piezasVendibles = Math.min(piezas, Math.floor(ritmo * diasHorizonte));
  const ganancia = piezasVendibles * utilidad - traslado;
  const ahorro = costo !== null && costo > 0 ? piezas * costo : null;

  const supuestos = [
    `El destino vende ${redondear(ritmo)} piezas al día; en ${diasHorizonte} días alcanza a vender ${piezasVendibles} de ${piezas}.`,
    `Utilidad por pieza según SICAR: ${redondear(utilidad)}.`,
  ];
  if (traslado > 0) supuestos.push(`Costo del traslado: ${redondear(traslado)}.`);
  if (ahorro !== null) supuestos.push("El ahorro es efectivo que no se gasta en comprar esas piezas; no es utilidad.");

  return {
    tipo: "traspaso",
    estado: ganancia > 0 ? ESTADOS_IMPACTO.ESTIMADO : ESTADOS_IMPACTO.NO_CONVIENE,
    ganancia: redondear(ganancia),
    ahorro: ahorro === null ? null : redondear(ahorro),
    piezasVendibles,
    diasHorizonte,
    faltantes: ahorro === null ? ["costo por pieza para calcular el ahorro"] : [],
    supuestos,
  };
}

/*
 * Compra (normal o de temporada).
 * Lo que no se vende en la temporada se remata a valorRemateUnitario
 * (por defecto 50% del costo) y esa pérdida se descuenta.
 */
export function calcularImpactoCompra({
  unidades,
  costoUnitario,
  precioVenta,
  ventaDiariaEstimada,
  diasTemporada,
  valorRemateUnitario = null,
  capitalDisponible = null,
} = {}) {
  const piezas = numero(unidades);
  const costo = numero(costoUnitario);
  const precio = numero(precioVenta);
  const ritmo = numero(ventaDiariaEstimada);
  const dias = numero(diasTemporada);

  const faltantes = [];
  if (!piezas || piezas <= 0) faltantes.push("unidades a comprar");
  if (costo === null) faltantes.push("costo por pieza");
  if (precio === null) faltantes.push("precio de venta");
  if (ritmo === null) faltantes.push("venta diaria estimada");
  if (!dias || dias <= 0) faltantes.push("días de temporada");
  if (faltantes.length) return faltan("compra", faltantes);

  const remate = numero(valorRemateUnitario) ?? costo * FACTOR_REMATE_PREDETERMINADO;
  const capacidadVenta = Math.floor(ritmo * dias);
  const vendidas = Math.min(piezas, capacidadVenta);
  const sobrantes = piezas - vendidas;
  const inversion = piezas * costo;
  const ganancia = vendidas * (precio - costo) - sobrantes * Math.max(0, costo - remate);
  const ventaDiariaDinero = ritmo * precio;
  const diasRecuperacion = ventaDiariaDinero > 0 ? Math.ceil(inversion / ventaDiariaDinero) : null;
  const capital = numero(capitalDisponible);

  let estado = ganancia > 0 ? ESTADOS_IMPACTO.ESTIMADO : ESTADOS_IMPACTO.NO_CONVIENE;
  const supuestos = [
    `Se venden ${vendidas} de ${piezas} piezas en ${dias} días (${redondear(ritmo)} al día).`,
    `Margen por pieza: ${redondear(precio - costo)}.`,
  ];
  if (sobrantes > 0) {
    supuestos.push(`Sobran ${sobrantes} piezas; se rematan a ${redondear(remate)} cada una.`);
  }
  const faltantesResultado = [];
  if (capital === null) {
    faltantesResultado.push("liquidez confirmada para comprar");
    if (estado === ESTADOS_IMPACTO.ESTIMADO) estado = ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ;
  } else if (inversion > capital && estado === ESTADOS_IMPACTO.ESTIMADO) {
    estado = ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ;
    supuestos.push(`La inversión (${redondear(inversion)}) supera el dinero disponible (${redondear(capital)}).`);
  }

  return {
    tipo: "compra",
    estado,
    ganancia: redondear(ganancia),
    ahorro: null,
    inversion: redondear(inversion),
    retorno: inversion > 0 ? Math.round((ganancia / inversion) * 1000) / 1000 : null,
    diasRecuperacion,
    unidadesRecomendadas: Math.min(piezas, capacidadVenta),
    faltantes: faltantesResultado,
    supuestos,
  };
}

/*
 * Campaña de marketing.
 * Acepta ventas adicionales estimadas, o ventas con y sin campaña
 * (por ejemplo, misma semana del mes anterior) para calcular el aumento.
 */
export function calcularImpactoCampana({
  presupuesto,
  margenBruto,
  ventasAdicionalesEstimadas = null,
  ventasConCampana = null,
  ventasSinCampana = null,
} = {}) {
  const gasto = numero(presupuesto);
  const margen = numero(margenBruto);
  let adicionales = numero(ventasAdicionalesEstimadas);
  const con = numero(ventasConCampana);
  const sin = numero(ventasSinCampana);
  if (adicionales === null && con !== null && sin !== null) adicionales = con - sin;

  const faltantes = [];
  if (gasto === null || gasto < 0) faltantes.push("presupuesto de la campaña");
  if (margen === null || margen <= 0 || margen >= 1) faltantes.push("margen bruto (entre 0 y 1)");
  if (adicionales === null) faltantes.push("ventas adicionales esperadas o ventas con y sin campaña");
  if (faltantes.length) return faltan("campana", faltantes);

  const ganancia = adicionales * margen - gasto;
  const roasEquilibrio = Math.round((1 / margen) * 100) / 100;
  const roasEstimado = gasto > 0 ? Math.round((adicionales / gasto) * 100) / 100 : null;

  return {
    tipo: "campana",
    estado: ganancia > 0 ? ESTADOS_IMPACTO.ESTIMADO : ESTADOS_IMPACTO.NO_CONVIENE,
    ganancia: redondear(ganancia),
    ahorro: null,
    roasEquilibrio,
    roasEstimado,
    faltantes: [],
    supuestos: [
      `Ventas adicionales: ${redondear(adicionales)} con margen de ${Math.round(margen * 100)}%.`,
      `Para no perder, cada peso de publicidad debe traer ${roasEquilibrio} pesos de venta.`,
    ],
  };
}

/*
 * ROAS histórico: mediana de venta/gasto de campañas ya medidas.
 * Se usa la mediana para que una campaña excepcional no infle el pronóstico.
 * historial: [{ venta, gasto }] con ambos confirmados.
 */
export function calcularRoasHistorico(historial = []) {
  const valores = (historial || [])
    .map((campana) => ({ venta: numero(campana?.venta), gasto: numero(campana?.gasto) }))
    .filter((campana) => campana.venta !== null && campana.venta >= 0 && campana.gasto > 0)
    .map((campana) => campana.venta / campana.gasto)
    .sort((a, b) => a - b);

  if (!valores.length) {
    return { roas: null, campanas: 0, confianza: "sin_datos" };
  }
  const mitad = Math.floor(valores.length / 2);
  const mediana = valores.length % 2 ? valores[mitad] : (valores[mitad - 1] + valores[mitad]) / 2;
  return {
    roas: Math.round(mediana * 100) / 100,
    campanas: valores.length,
    confianza: valores.length >= 3 ? "media" : "baja",
  };
}

/*
 * Pronóstico antes de lanzar: con el presupuesto y el ROAS histórico,
 * cuánto se espera vender y ganar.
 */
export function pronosticarCampana({ presupuesto, margenBruto, historial = [] } = {}) {
  const historico = calcularRoasHistorico(historial);
  const gasto = numero(presupuesto);
  const margen = numero(margenBruto);
  const roasEquilibrio = margen > 0 && margen < 1 ? Math.round((1 / margen) * 100) / 100 : null;

  if (historico.roas === null) {
    return {
      ...faltan("campana", ["campañas anteriores con venta y gasto confirmados"]),
      roasEquilibrio,
      historico,
    };
  }

  const impacto = calcularImpactoCampana({
    presupuesto: gasto,
    margenBruto: margen,
    ventasAdicionalesEstimadas: gasto === null ? null : gasto * historico.roas,
  });

  return {
    ...impacto,
    roasEquilibrio: impacto.roasEquilibrio ?? roasEquilibrio,
    ventasEsperadas: gasto === null ? null : redondear(gasto * historico.roas),
    historico,
    supuestos: [
      `Con base en ${historico.campanas} campaña(s) medidas, cada peso invertido trajo ${historico.roas} pesos de venta (mediana).`,
      ...(impacto.supuestos || []),
      ...(historico.confianza === "baja" ? ["Pocas campañas medidas: tómalo como referencia, no como promesa."] : []),
    ],
  };
}

/*
 * Pago anticipado de deuda: interés que se deja de pagar.
 * Es ahorro (sale menos dinero), y también mejora la utilidad neta.
 */
export function calcularImpactoPagoDeuda({
  saldo,
  monto,
  tasaAnual,
  diasAnticipo,
  cargoEvitado = 0,
} = {}) {
  const deuda = numero(saldo);
  const pago = numero(monto);
  const tasa = numero(tasaAnual);
  const dias = numero(diasAnticipo);
  const cargo = numero(cargoEvitado) ?? 0;

  const faltantes = [];
  if (!deuda || deuda <= 0) faltantes.push("saldo de la deuda");
  if (!pago || pago <= 0) faltantes.push("monto a pagar");
  if (tasa === null || tasa < 0) faltantes.push("tasa de interés anual");
  if (dias === null || dias < 0) faltantes.push("días de anticipo");
  if (faltantes.length) return faltan("pago_deuda", faltantes);

  const aplicado = Math.min(pago, deuda);
  const interes = aplicado * tasa * (dias / 365);
  const ahorro = interes + cargo;

  return {
    tipo: "pago_deuda",
    estado: ahorro > 0 ? ESTADOS_IMPACTO.ESTIMADO : ESTADOS_IMPACTO.NO_CONVIENE,
    ganancia: redondear(ahorro),
    ahorro: redondear(ahorro),
    faltantes: [],
    supuestos: [
      `Se abonan ${redondear(aplicado)} con ${dias} días de anticipo a ${Math.round(tasa * 1000) / 10}% anual.`,
      ...(cargo > 0 ? [`Evita un cargo de ${redondear(cargo)}.`] : []),
    ],
  };
}

const ORDEN_ESTADO = {
  [ESTADOS_IMPACTO.ESTIMADO]: 0,
  [ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ]: 1,
  [ESTADOS_IMPACTO.FALTAN_DATOS]: 2,
  [ESTADOS_IMPACTO.NO_CONVIENE]: 3,
};

/*
 * Ordena acciones por dinero: primero las que convienen y ya se pueden
 * hacer, luego las que esperan liquidez, luego las que necesitan datos.
 * Cada acción: { id, titulo, impacto: <resultado de calcularImpacto*> }
 */
export function priorizarAcciones(acciones = []) {
  return [...(acciones || [])]
    .filter((accion) => accion && accion.impacto)
    .sort((a, b) => {
      const estado = (ORDEN_ESTADO[a.impacto.estado] ?? 9) - (ORDEN_ESTADO[b.impacto.estado] ?? 9);
      if (estado !== 0) return estado;
      const ganancia = (b.impacto.ganancia ?? -Infinity) - (a.impacto.ganancia ?? -Infinity);
      if (ganancia !== 0) return ganancia;
      return (b.impacto.ahorro ?? 0) - (a.impacto.ahorro ?? 0);
    });
}

/*
 * Totales solo de acciones que convienen y se pueden ejecutar ahora.
 */
export function resumirImpacto(acciones = []) {
  let ganancia = 0;
  let ahorro = 0;
  let listas = 0;
  let pendientes = 0;

  for (const accion of acciones || []) {
    const impacto = accion?.impacto;
    if (!impacto) continue;
    if (impacto.estado === ESTADOS_IMPACTO.ESTIMADO) {
      listas += 1;
      ganancia += impacto.ganancia ?? 0;
      if (impacto.tipo !== "pago_deuda") ahorro += impacto.ahorro ?? 0;
    } else if (
      impacto.estado === ESTADOS_IMPACTO.FALTAN_DATOS ||
      impacto.estado === ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ
    ) {
      pendientes += 1;
    }
  }

  return {
    ganancia: redondear(ganancia),
    ahorro: redondear(ahorro),
    accionesListas: listas,
    accionesPendientes: pendientes,
  };
}
