import { resumirOperacionFlotilla } from "./operacionFlotilla.js";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function dinero(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: Number(valor) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numero(valor));
}

function nombrePropietario(unidad = {}) {
  const principal = Array.isArray(unidad.propietarios) ? unidad.propietarios[0] : null;
  if (typeof principal === "string") return principal.trim() || "Sin socio asignado";
  return String(principal?.nombre || "Sin socio asignado").trim();
}

function esRental(tipoPago) {
  return ["RENTAL_SMALL", "RENTAL_LARGE"].includes(tipoPago);
}

function socioDeOperacion(operacion, tipoPago) {
  if (esRental(tipoPago)) return "Rental · Abraham, Chory y Kary";
  return nombrePropietario(operacion.unidad);
}

function fechaLegible(fecha) {
  if (!fecha) return "";
  const valor = new Date(`${fecha}T12:00:00Z`);
  return Number.isNaN(valor.getTime()) ? fecha : DIAS[valor.getUTCDay()];
}

function etiquetaTipo(tipoPago) {
  if (tipoPago === "RENTAL_SMALL") return "Small Rental";
  if (tipoPago === "RENTAL_LARGE") return "Large Rental";
  return "MLP";
}

function dueñoUnidad(unidad = {}) {
  const propietario = nombrePropietario(unidad);
  return propietario === "Sin socio asignado" ? "" : propietario;
}

function nombreUnidad(operacion = {}) {
  const unidad = operacion.unidad || {};
  const alias = String(unidad.alias || unidad.nombre || "").trim();
  const propietario = dueñoUnidad(unidad);
  if (alias) return alias;
  if (esRental(operacion.tipo_pago || unidad.tipo_pago_chory) && propietario) return `Rental ${propietario}`;
  return propietario || etiquetaTipo(operacion.tipo_pago || unidad.tipo_pago_chory || "MLP");
}

function claveGrupo(operacion = {}) {
  const conductor = operacion.driver_auth_user_id || String(operacion.chofer_nombre || "").trim().toLowerCase();
  return `${conductor}::${operacion.unidad_id || operacion.unidad?.placas || "sin-unidad"}`;
}

function claveDescuento(descuento = {}) {
  const pnr = descuento.pnr || {};
  const conductor = pnr.driver_auth_user_id || String(pnr.chofer_nombre || "").trim().toLowerCase();
  return `${conductor}::${pnr.unidad_id || pnr.unidad?.placas || "sin-unidad"}`;
}

function lineaRuta(fila) {
  const claseRuta = fila.tipoPago === "MLP" && fila.tipoRuta === "SDD" ? "SDD" : "Ruta";
  const prefijo = `${fechaLegible(fila.fecha)} — ${claseRuta} ${fila.ruta} ${etiquetaTipo(fila.tipoPago)}`;
  if (fila.tipoPago !== "MLP") return `${prefijo} ${moneda(fila.importeRuta)}`;
  if (fila.bonoKilometraje > 0) {
    return `${prefijo} ${moneda(fila.pagoBase)} + ${moneda(fila.bonoKilometraje)} Bono (${fila.kilometros.toFixed(2)} km) = ${moneda(fila.importeRuta)}`;
  }
  return `${prefijo} ${moneda(fila.importeRuta)} (${fila.kilometros.toFixed(2)} km, sin bono)`;
}

function formatoDescuento(monto, concepto, complemento = "") {
  return `-$ ${moneda(monto).replace(/^\$/, "")} ${concepto}${complemento ? ` ${complemento}` : ""}`;
}

function normalizarAjustes(ajustes = []) {
  return (Array.isArray(ajustes) ? ajustes : []).filter((item) => item?.estado !== "ANULADO");
}

export function crearPrefacturasWhatsApp({
  operaciones = [],
  descuentosPnr = [],
  ajustes = [],
  desde = "",
  hasta = "",
  cedis = "STT1",
} = {}) {
  const grupos = new Map();

  (Array.isArray(operaciones) ? operaciones : []).forEach((operacion) => {
    const resumen = operacion.resumen || resumirOperacionFlotilla(operacion, operacion.movimientos || []);
    const tipoPago = operacion.tipo_pago || operacion.unidad?.tipo_pago_chory || "MLP";
    const importeRuta = tipoPago === "MLP"
      ? dinero(resumen.pagoBase + resumen.bonoKilometraje)
      : dinero(resumen.ingresoRental);
    const clave = claveGrupo(operacion);
    const actual = grupos.get(clave) || {
      clave,
      driverAuthUserId: operacion.driver_auth_user_id || null,
      unidadId: operacion.unidad_id || null,
      operador: operacion.chofer_nombre || "Chofer sin nombre",
      placas: operacion.unidad?.placas || "Sin placas",
      unidad: nombreUnidad(operacion),
      socio: socioDeOperacion(operacion, tipoPago),
      filas: [],
    };
    actual.filas.push({
      fecha: operacion.fecha,
      ruta: operacion.codigo_ruta || "Sin folio",
      tipoRuta: String(operacion.tipo_ruta || "").toUpperCase(),
      tipoPago,
      kilometros: dinero(resumen.kilometros),
      pagoBase: dinero(resumen.pagoBase),
      bonoKilometraje: dinero(resumen.bonoKilometraje),
      importeRuta,
      ambulanciaFavor: dinero(resumen.ambulanciasConfirmadas),
      ambulanciaDescuento: dinero(resumen.ambulanciasDescontadas),
      otros: dinero(resumen.otrosConfirmados),
      pagoChofer: dinero(resumen.ganado),
      adelantos: dinero(resumen.adelantosEntregados),
      prestamosGasolina: dinero(resumen.prestamosGasolina),
    });
    grupos.set(clave, actual);
  });

  const pnrPorGrupo = new Map();
  (Array.isArray(descuentosPnr) ? descuentosPnr : [])
    .filter((item) => item?.estado === "APLICADO")
    .forEach((item) => {
      const clave = claveDescuento(item);
      pnrPorGrupo.set(clave, dinero((pnrPorGrupo.get(clave) || 0) + numero(item.monto)));
    });

  const ajustesPorGrupo = new Map();
  normalizarAjustes(ajustes).forEach((item) => {
    const conductor = item.driver_auth_user_id || String(item.chofer_nombre || "").trim().toLowerCase();
    const clave = `${conductor}::${item.unidad_id || item.placas || "sin-unidad"}`;
    if (!ajustesPorGrupo.has(clave)) ajustesPorGrupo.set(clave, []);
    ajustesPorGrupo.get(clave).push(item);
  });

  const prefacturas = [...grupos.values()].map((grupo) => {
    grupo.filas.sort((a, b) => `${a.fecha}-${a.ruta}`.localeCompare(`${b.fecha}-${b.ruta}`));
    const ajustesGrupo = ajustesPorGrupo.get(grupo.clave) || [];
    const porCategoria = (categoria) => ajustesGrupo
      .filter((item) => item.categoria === categoria)
      .reduce((total, item) => total + numero(item.monto), 0);
    // Las ambulancias son movimientos entre choferes: afectan su pago, no el cobro de rutas del socio.
    const totalRutas = dinero(grupo.filas.reduce((total, fila) => total + fila.importeRuta + fila.otros, 0));
    const descuentos = {
      noShow: dinero(porCategoria("NO_SHOW")),
      siniestro: dinero(porCategoria("SINIESTRO")),
      pnr: dinero(pnrPorGrupo.get(grupo.clave)),
      penalizacion: dinero(porCategoria("PENALIZACION")),
      fondoUnidad: dinero(porCategoria("FONDO_UNIDAD")),
    };
    const totalDescuentos = dinero(Object.values(descuentos).reduce((total, valor) => total + valor, 0));
    const fondo = ajustesGrupo.find((item) => item.categoria === "FONDO_UNIDAD");
    const complementoFondo = fondo?.numero_parcialidad
      ? `(Acumulado: ${fondo.numero_parcialidad}/${fondo.total_parcialidades || 24})`
      : "";
    const lineas = grupo.filas.map(lineaRuta);
    const mensaje = [
      `Prefactura: ${grupo.operador}`,
      `📅 CORTE: ${desde} al ${hasta}`,
      `📍 CEDIS: ${String(cedis || "STT1").trim() || "STT1"}`,
      `👤 Operador: ${grupo.operador}`,
      `🚐 Unidad: ${grupo.unidad} / ${grupo.placas}`,
      "",
      ...lineas,
      "",
      `Total de Rutas: ${moneda(totalRutas)}`,
      "",
      "Descuentos",
      formatoDescuento(descuentos.noShow, "NO SHOW"),
      formatoDescuento(descuentos.siniestro, "SINIESTRO"),
      formatoDescuento(descuentos.pnr, "PNRS / LOST"),
      formatoDescuento(descuentos.penalizacion, "PENALIZACIÓN"),
      ...(descuentos.fondoUnidad > 0 ? [formatoDescuento(descuentos.fondoUnidad, "FONDO POR UNIDAD", complementoFondo)] : []),
      `👉 Total después de descuentos: ${moneda(totalRutas - totalDescuentos)}`,
    ].join("\n");

    const ganadoChofer = dinero(grupo.filas.reduce((total, fila) => total + fila.pagoChofer, 0));
    const adelantos = dinero(grupo.filas.reduce((total, fila) => total + fila.adelantos, 0));
    const prestamosGasolina = dinero(grupo.filas.reduce((total, fila) => total + fila.prestamosGasolina, 0));
    const totalPagoChofer = dinero(ganadoChofer - adelantos - prestamosGasolina - descuentos.pnr);
    const mensajeChofer = [
      `Resumen de pago: ${grupo.operador}`,
      `📅 CORTE: ${desde} al ${hasta}`,
      `🚐 Unidad: ${grupo.unidad} / ${grupo.placas}`,
      "",
      `Ganado en rutas y apoyos: ${moneda(ganadoChofer)}`,
      `-$ ${moneda(adelantos).replace(/^\$/, "")} ADELANTOS`,
      `-$ ${moneda(prestamosGasolina).replace(/^\$/, "")} GASOLINA SIN EVIDENCIA (PRÉSTAMO PERSONAL)`,
      `-$ ${moneda(descuentos.pnr).replace(/^\$/, "")} PNRS / LOST`,
      `👉 Total estimado a pagar: ${moneda(totalPagoChofer)}`,
    ].join("\n");

    return {
      ...grupo,
      totalRutas,
      descuentos,
      totalDescuentos,
      totalDespuesDescuentos: dinero(totalRutas - totalDescuentos),
      mensaje,
      mensajeChofer,
    };
  }).sort((a, b) => a.socio.localeCompare(b.socio) || a.operador.localeCompare(b.operador));

  const resumenes = new Map();
  prefacturas.forEach((prefactura) => {
    const actual = resumenes.get(prefactura.socio) || [];
    actual.push(prefactura);
    resumenes.set(prefactura.socio, actual);
  });

  const resumenesSocio = [...resumenes.entries()].map(([socio, items]) => {
    const subtotal = dinero(items.reduce((total, item) => total + item.totalRutas, 0));
    const descuentos = dinero(items.reduce((total, item) => total + item.totalDescuentos, 0));
    const titulo = socio.startsWith("Rental") ? "RENTAL COMPARTIDA" : `FLOTA ${socio.toUpperCase()}`;
    const etiquetaSubtotal = socio.startsWith("Rental") ? "Rental compartida" : `Flota ${socio}`;
    const mensaje = [
      `RESUMEN DE PREFACTURAS — ${titulo}`,
      `📅 CORTE: ${desde} al ${hasta}`,
      "",
      ...items.map((item, indice) => `${indice + 1}. ${item.operador} — ${moneda(item.totalRutas)}`),
      "",
      `Subtotal Rutas ${etiquetaSubtotal}: ${moneda(subtotal)}`,
      `Descuentos: -${moneda(descuentos)}`,
      "",
      `TOTAL ${titulo} A COBRAR: ${moneda(subtotal - descuentos)}`,
    ].join("\n");
    return { socio, titulo, subtotal, descuentos, total: dinero(subtotal - descuentos), mensaje };
  });

  return { prefacturas, resumenesSocio };
}

