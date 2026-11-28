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

/*
 * Convierte a número solo valores que de verdad son números.
 * Booleanos, objetos, textos vacíos o con letras → null (dato ausente).
 */
function numero(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string") {
    const limpio = valor.trim();
    if (!limpio) return null;
    valor = limpio;
  }
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

// Piezas: enteros mayores a cero.
function piezasValidas(valor) {
  const convertido = numero(valor);
  return convertido !== null && convertido > 0 && Number.isInteger(convertido) ? convertido : null;
}

// Cantidad opcional: ausente usa el predeterminado; informada pero
// inválida (negativa, texto, booleano) se reporta, nunca se vuelve cero.
function opcionalNoNegativo(valor, predeterminado = 0) {
  if (valor === null || valor === undefined || (typeof valor === "string" && !valor.trim())) {
    return { valor: predeterminado, valido: true };
  }
  const convertido = numero(valor);
  return convertido !== null && convertido >= 0
    ? { valor: convertido, valido: true }
    : { valor: null, valido: false };
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
 *
 * Cobertura: la utilidad por pieza solo se calcula si TODAS las piezas
 * vendidas del producto traen utilidad confiable; con cobertura parcial
 * queda en null (faltante) para no repartir una utilidad parcial entre
 * todas las piezas. Lo mismo para el precio.
 *
 * Cero real vs. ausente: ver datoConfiable. Las banderas
 * utilidadDisponible / importeDisponible (cuando el importador las guarda)
 * prevalecen sobre el valor numérico.
 */
/*
 * Un valor del reporte es confiable si:
 * - la bandera de disponibilidad no lo niega (false siempre gana), y
 * - es distinto de cero, o es cero con la bandera en true.
 * El importador guardaba 0 cuando la columna no existía, así que un cero
 * sin confirmación nunca se toma como dato real.
 */
function datoConfiable(valor, disponible) {
  if (disponible === false || valor === null) return false;
  if (valor === 0) return disponible === true;
  return true;
}

export function resumirMargenesPorProducto(ventas = []) {
  const acumulado = new Map();

  for (const venta of ventas || []) {
    const clave = clavePorCodigo(venta?.codigo);
    const piezas = numero(venta?.cantidad);
    if (!clave || piezas === null || piezas <= 0) continue;

    const registro = acumulado.get(clave) || {
      piezas: 0,
      piezasConImporte: 0,
      piezasConUtilidad: 0,
      importe: 0,
      utilidad: 0,
    };
    registro.piezas += piezas;

    const importe = numero(venta?.importe);
    if (datoConfiable(importe, venta?.importeDisponible) && importe >= 0) {
      registro.importe += importe;
      registro.piezasConImporte += piezas;
    }

    const utilidad = numero(venta?.utilidad);
    if (datoConfiable(utilidad, venta?.utilidadDisponible)) {
      registro.utilidad += utilidad;
      registro.piezasConUtilidad += piezas;
    }
    acumulado.set(clave, registro);
  }

  const margenes = new Map();
  for (const [clave, registro] of acumulado) {
    const coberturaImporte = registro.piezasConImporte / registro.piezas;
    const coberturaUtilidad = registro.piezasConUtilidad / registro.piezas;
    const precioPromedio =
      coberturaImporte === 1 && registro.importe > 0 ? registro.importe / registro.piezas : null;
    const utilidadUnitaria = coberturaUtilidad === 1 ? registro.utilidad / registro.piezas : null;

    margenes.set(clave, {
      piezas: registro.piezas,
      coberturaImporte: Math.round(coberturaImporte * 1000) / 1000,
      coberturaUtilidad: Math.round(coberturaUtilidad * 1000) / 1000,
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
 * Traspaso entre sucursales, comparado contra no traspasar.
 *
 * Con D = demanda del periodo y S = existencia:
 * - Venta nueva en destino = min(Dd, Sd + p) − min(Dd, Sd)
 * - Venta perdida en origen = min(Do, So) − min(Do, So − p)
 *   (solo lo que el traspaso le quita; no se le atribuye un faltante
 *   que el origen ya tenía).
 * ganancia = venta nueva × utilidad en destino
 *          − venta perdida × utilidad en origen − costo del traslado.
 *
 * Costo del traslado: si no se captura, se calcula con 0 pero el
 * resultado lo declara (costoTrasladoConfirmado: false + faltante).
 *
 * Ahorro (compra evitada): solo con compraEvitada === true, confirmada
 * por un plan de compra, y limitado a unidadesCompraEvitada si se
 * informa. La necesidad de inventario por sí sola no confirma compra.
 */
export function calcularImpactoTraspaso({
  cantidad,
  utilidadUnitaria,
  utilidadUnitariaOrigen = null,
  costoUnitario = null,
  ventaDiariaDestino,
  existenciaDestino,
  ventaDiariaOrigen,
  existenciaOrigen,
  diasHorizonte = DIAS_HORIZONTE_TRASPASO,
  costoTraslado = null,
  compraEvitada = null,
  unidadesCompraEvitada = null,
} = {}) {
  const piezas = piezasValidas(cantidad);
  const utilidadDestino = numero(utilidadUnitaria);
  const origenInformado = utilidadUnitariaOrigen !== null && utilidadUnitariaOrigen !== undefined;
  const utilidadOrigen = origenInformado ? numero(utilidadUnitariaOrigen) : utilidadDestino;
  const ritmoDestino = numero(ventaDiariaDestino);
  const stockDestino = numero(existenciaDestino);
  const ritmoOrigen = numero(ventaDiariaOrigen);
  const stockOrigen = numero(existenciaOrigen);
  const horizonte = numero(diasHorizonte);
  const trasladoCapturado = !(costoTraslado === null || costoTraslado === undefined || (typeof costoTraslado === "string" && !costoTraslado.trim()));
  const traslado = opcionalNoNegativo(costoTraslado);
  const costo = numero(costoUnitario);
  const tope = unidadesCompraEvitada === null || unidadesCompraEvitada === undefined
    ? { valor: null, valido: true }
    : opcionalNoNegativo(unidadesCompraEvitada, null);

  const faltantes = [];
  if (piezas === null) faltantes.push("piezas a traspasar (entero mayor a cero)");
  if (utilidadDestino === null) faltantes.push("utilidad por pieza completa en destino (reporte Ventas por artículo con utilidad)");
  if (origenInformado && utilidadOrigen === null) faltantes.push("utilidad por pieza válida en origen");
  if (ritmoDestino === null || ritmoDestino < 0) faltantes.push("venta diaria de la sucursal destino");
  if (stockDestino === null) faltantes.push("existencia de la sucursal destino");
  if (ritmoOrigen === null || ritmoOrigen < 0) faltantes.push("venta diaria de la sucursal origen");
  if (stockOrigen === null || stockOrigen < 0) faltantes.push("existencia de la sucursal origen (cero o más)");
  if (horizonte === null || horizonte <= 0) faltantes.push("días del horizonte (mayor a cero)");
  if (!traslado.valido) faltantes.push("costo del traslado válido (cero o más)");
  if (!tope.valido) faltantes.push("unidades de compra evitada válidas");
  if (piezas !== null && stockOrigen !== null && stockOrigen >= 0 && piezas > stockOrigen) {
    faltantes.push("existencia suficiente en origen para las piezas a traspasar");
  }
  if (faltantes.length) return faltan("traspaso", faltantes);

  // Existencia negativa en destino es un error de inventario: no cubre demanda.
  const stockDestinoUtil = Math.max(0, stockDestino);
  const demandaDestino = Math.floor(ritmoDestino * horizonte);
  const ventaNuevaDestino =
    Math.min(demandaDestino, stockDestinoUtil + piezas) - Math.min(demandaDestino, stockDestinoUtil);
  const demandaOrigen = Math.floor(ritmoOrigen * horizonte);
  const quedaEnOrigen = stockOrigen - piezas;
  const ventaPerdidaOrigen =
    Math.min(demandaOrigen, stockOrigen) - Math.min(demandaOrigen, quedaEnOrigen);
  const ganancia =
    ventaNuevaDestino * utilidadDestino - ventaPerdidaOrigen * utilidadOrigen - traslado.valor;

  const faltantesResultado = [];
  if (!trasladoCapturado) faltantesResultado.push("costo del traslado (se calculó como 0)");

  let ahorro = null;
  let unidadesEvitadas = null;
  if (compraEvitada === true) {
    unidadesEvitadas = tope.valor === null ? piezas : Math.min(piezas, Math.floor(tope.valor));
    if (costo !== null && costo > 0) ahorro = unidadesEvitadas * costo;
    else faltantesResultado.push("costo por pieza para calcular la compra evitada");
  } else {
    faltantesResultado.push("plan de compra que confirme la compra evitada");
  }

  const supuestos = [
    `En ${horizonte} días el destino vende ${demandaDestino} piezas; ya tiene ${stockDestinoUtil}, así que el traspaso agrega ${ventaNuevaDestino} ventas.`,
    ventaPerdidaOrigen > 0
      ? `El origen deja de vender ${ventaPerdidaOrigen} piezas por quedarse con ${quedaEnOrigen}.`
      : `El origen conserva ${quedaEnOrigen} piezas, suficientes para su venta del periodo.`,
    origenInformado && utilidadOrigen !== utilidadDestino
      ? `Utilidad por pieza según SICAR: ${redondear(utilidadDestino)} en destino y ${redondear(utilidadOrigen)} en origen.`
      : `Utilidad por pieza según SICAR: ${redondear(utilidadDestino)}.`,
    trasladoCapturado
      ? `Costo del traslado: ${redondear(traslado.valor)}.`
      : "Costo del traslado no capturado: se calculó como 0; la ganancia real será menor si el traslado cuesta.",
  ];
  if (ahorro !== null) {
    supuestos.push(`Evita comprar ${unidadesEvitadas} piezas según el plan de compra; mejora la caja, no la utilidad.`);
  }

  return {
    tipo: "traspaso",
    estado: ganancia > 0 ? ESTADOS_IMPACTO.ESTIMADO : ESTADOS_IMPACTO.NO_CONVIENE,
    ganancia: redondear(ganancia),
    ahorro: ahorro === null ? null : redondear(ahorro),
    ventaNuevaDestino,
    ventaPerdidaOrigen,
    unidadesCompraEvitada: unidadesEvitadas,
    costoTrasladoConfirmado: trasladoCapturado,
    diasHorizonte: horizonte,
    faltantes: faltantesResultado,
    supuestos,
  };
}

/*
 * Compra (normal o de temporada).
 * Lo que no se vende en la temporada se remata a valorRemateUnitario
 * (por defecto 50% del costo, marcado como supuesto) y esa pérdida se
 * descuenta.
 *
 * Recuperación: se calcula con lo que realmente entra. Si la venta de la
 * temporada cubre la inversión, se dan los días; si solo se cubre con el
 * remate al final, se indica; si ni así se cubre, es no recuperable.
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
  const piezas = piezasValidas(unidades);
  const costo = numero(costoUnitario);
  const precio = numero(precioVenta);
  const ritmo = numero(ventaDiariaEstimada);
  const dias = numero(diasTemporada);
  const remateInformado = opcionalNoNegativo(valorRemateUnitario, null);
  const capitalInformado = opcionalNoNegativo(capitalDisponible, null);

  const faltantes = [];
  if (piezas === null) faltantes.push("unidades a comprar (entero mayor a cero)");
  if (costo === null || costo <= 0) faltantes.push("costo por pieza");
  if (precio === null || precio <= 0) faltantes.push("precio de venta");
  if (ritmo === null || ritmo < 0) faltantes.push("venta diaria estimada");
  if (dias === null || dias <= 0) faltantes.push("días de temporada");
  if (!remateInformado.valido) faltantes.push("precio de remate válido (cero o más)");
  if (!capitalInformado.valido) faltantes.push("dinero disponible válido (cero o más)");
  if (faltantes.length) return faltan("compra", faltantes);

  const remateSupuesto = remateInformado.valor === null;
  const remate = remateSupuesto ? costo * FACTOR_REMATE_PREDETERMINADO : remateInformado.valor;
  const capacidadVenta = Math.floor(ritmo * dias);
  const vendidas = Math.min(piezas, capacidadVenta);
  const sobrantes = piezas - vendidas;
  const inversion = piezas * costo;
  const ingresoVenta = vendidas * precio;
  const ingresoRemate = sobrantes * remate;
  const ganancia = ingresoVenta + ingresoRemate - inversion;
  const capital = capitalInformado.valor;

  let recuperacion;
  let diasRecuperacion = null;
  if (ingresoVenta >= inversion && ritmo > 0) {
    recuperacion = "en_temporada";
    diasRecuperacion = Math.ceil(inversion / (ritmo * precio));
  } else if (ingresoVenta + ingresoRemate >= inversion) {
    recuperacion = "con_remate";
    diasRecuperacion = Math.ceil(dias);
  } else {
    recuperacion = "no_recuperable";
  }

  let estado = ganancia > 0 ? ESTADOS_IMPACTO.ESTIMADO : ESTADOS_IMPACTO.NO_CONVIENE;
  const supuestos = [
    `Se venden ${vendidas} de ${piezas} piezas en ${dias} días (${redondear(ritmo)} al día).`,
    `Margen por pieza: ${redondear(precio - costo)}.`,
  ];
  if (sobrantes > 0) {
    supuestos.push(
      `Sobran ${sobrantes} piezas; se rematan a ${redondear(remate)} cada una${remateSupuesto ? " (supuesto: mitad del costo)" : ""}.`
    );
  }
  if (recuperacion === "con_remate") supuestos.push("La inversión solo se recupera al rematar lo que sobra al final de la temporada.");
  if (recuperacion === "no_recuperable") supuestos.push("Con estos datos la inversión no se recupera ni con el remate.");

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
    retorno: Math.round((ganancia / inversion) * 1000) / 1000,
    recuperacion,
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
  const cargoInformado = opcionalNoNegativo(cargoEvitado);
  const cargo = cargoInformado.valor ?? 0;

  const faltantes = [];
  if (!deuda || deuda <= 0) faltantes.push("saldo de la deuda");
  if (!pago || pago <= 0) faltantes.push("monto a pagar");
  if (tasa === null || tasa < 0) faltantes.push("tasa de interés anual");
  if (dias === null || dias < 0) faltantes.push("días de anticipo");
  if (!cargoInformado.valido) faltantes.push("cargo evitado válido (cero o más)");
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
 *
 * - Sin acciones calculables, ganancia y ahorro son null (no "cero
 *   confirmado"); la cobertura dice cuántas se pudieron calcular.
 * - Escenarios mutuamente excluyentes (misma mercancía de un origen hacia
 *   varios destinos) llevan el mismo accion.grupoExclusivo: de cada grupo
 *   solo se suma la opción con más ganancia.
 * - En pago de deuda ganancia y ahorro son el mismo interés: se cuenta
 *   una vez, como ganancia.
 */
export function resumirImpacto(acciones = []) {
  const lista = (acciones || []).filter((accion) => accion?.impacto);
  const listas = lista.filter((accion) => accion.impacto.estado === ESTADOS_IMPACTO.ESTIMADO);

  const mejorPorGrupo = new Map();
  for (const accion of listas) {
    const grupo = accion.grupoExclusivo || accion.id || accion;
    const actual = mejorPorGrupo.get(grupo);
    if (!actual || (accion.impacto.ganancia ?? 0) > (actual.impacto.ganancia ?? 0)) {
      mejorPorGrupo.set(grupo, accion);
    }
  }
  const sumables = [...mejorPorGrupo.values()];

  let ganancia = 0;
  let ahorro = 0;
  let conAhorro = 0;
  for (const accion of sumables) {
    ganancia += accion.impacto.ganancia ?? 0;
    if (accion.impacto.tipo !== "pago_deuda" && accion.impacto.ahorro !== null && accion.impacto.ahorro !== undefined) {
      ahorro += accion.impacto.ahorro;
      conAhorro += 1;
    }
  }

  const calculables = lista.filter(
    (accion) => accion.impacto.estado !== ESTADOS_IMPACTO.FALTAN_DATOS
  ).length;

  return {
    ganancia: sumables.length ? redondear(ganancia) : null,
    ahorro: conAhorro ? redondear(ahorro) : null,
    accionesListas: listas.length,
    accionesSumadas: sumables.length,
    accionesExcluidasPorEscenario: listas.length - sumables.length,
    accionesPendientes: lista.filter(
      (accion) =>
        accion.impacto.estado === ESTADOS_IMPACTO.FALTAN_DATOS ||
        accion.impacto.estado === ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ
    ).length,
    cobertura: { calculables, total: lista.length },
  };
}
