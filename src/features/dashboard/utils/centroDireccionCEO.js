import { calcularResumenDeudas } from "../../inteligencia/shared/resumenDeudas.js";

function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function fechaISO(valor) {
  const texto = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto ? texto : null;
}

function sumarDias(fecha, dias) {
  const base = new Date(`${fecha}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function diferenciaDias(fecha, hoy) {
  const fechaDato = fechaISO(fecha);
  const fechaHoy = fechaISO(hoy);
  if (!fechaDato || !fechaHoy) return null;
  return Math.floor((Date.parse(`${fechaHoy}T12:00:00Z`) - Date.parse(`${fechaDato}T12:00:00Z`)) / 86400000);
}

function hoyMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const tomar = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${tomar("year")}-${tomar("month")}-${tomar("day")}`;
}

export function consolidarCreditosProveedores(resultados = [], sucursalesEsperadas = 0, hoy = hoyMexico()) {
  const correctos = resultados
    .filter((resultado) => resultado.status === "fulfilled")
    .map((resultado) => resultado.value);
  const disponibles = correctos.filter((reporte) => reporte?.importacion || reporte?.disponible);
  const creditos = disponibles.flatMap((reporte) => reporte?.creditos || []);
  const fechasCorte = disponibles.map((reporte) => reporte?.fuente === "confirmacion_cero"
    ? reporte?.confirmacion?.fecha_corte
    : reporte?.fechaCorte || reporte?.importacion?.created_at).filter(Boolean).map((fecha) => String(fecha).slice(0, 10));
  const fuentesVigentes = disponibles.length === sucursalesEsperadas && disponibles.every((reporte) => {
    const fecha = reporte?.fuente === "confirmacion_cero"
      ? reporte?.confirmacion?.fecha_corte
      : reporte?.fechaCorte || reporte?.importacion?.created_at;
    const antiguedad = diferenciaDias(fecha, hoy);
    const vigencia = reporte?.fuente === "confirmacion_cero" ? 7 : 30;
    return antiguedad !== null && antiguedad >= 0 && antiguedad <= vigencia;
  });
  const saldosCompletos = creditos.every((credito) => {
    const saldo = numeroONulo(credito?.saldo);
    return saldo !== null && saldo >= 0;
  });
  const fuenteCompleta = sucursalesEsperadas > 0
    && disponibles.length === sucursalesEsperadas
    && fuentesVigentes
    && saldosCompletos;
  return {
    importacion: disponibles.find((reporte) => reporte?.importacion)?.importacion || null,
    confirmacion: disponibles.find((reporte) => reporte?.fuente === "confirmacion_cero")?.confirmacion || null,
    fuente: disponibles.length > 0 && disponibles.every((reporte) => reporte?.fuente === "confirmacion_cero")
      ? "confirmacion_cero"
      : "consolidado_sucursales",
    disponible: sucursalesEsperadas > 0 && disponibles.length === sucursalesEsperadas,
    fuenteCompleta,
    fuentesVigentes,
    saldosCompletos,
    fechaCorte: fechasCorte.sort()[0] || null,
    confirmacionesCeroFechas: disponibles
      .filter((reporte) => reporte?.fuente === "confirmacion_cero")
      .map((reporte) => reporte?.confirmacion?.fecha_corte)
      .filter(Boolean),
    confirmacionesCeroCompletas: disponibles
      .filter((reporte) => reporte?.fuente === "confirmacion_cero")
      .every((reporte) => Boolean(reporte?.confirmacion?.fecha_corte)),
    creditos,
    saldoTotal: creditos.reduce((total, credito) => total + Math.max(0, numeroONulo(credito?.saldo) || 0), 0),
    sucursalesEsperadas,
    sucursalesConReporte: disponibles.length,
  };
}

function resultadoCampana(campana = {}) {
  return campana?.resultado && typeof campana.resultado === "object"
    ? campana.resultado
    : {};
}

function campanaActiva(campana = {}) {
  const estado = String(campana?.estado || "").trim().toUpperCase();
  return !["BORRADOR", "PAUSADA", "FINALIZADA", "CANCELADA"].includes(estado);
}

function resumirCampanas(campanas = []) {
  const activas = (Array.isArray(campanas) ? campanas : []).filter(campanaActiva);
  const pausar = [];
  const medir = [];
  const crecer = [];

  for (const campana of activas) {
    const resultado = resultadoCampana(campana);
    const gasto = numeroONulo(resultado.gastoAcumulado);
    const venta = numeroONulo(resultado.ventaAcumulada);
    const ventaConfirmada = resultado?.camposConfirmados?.venta === true;
    const gastoConfirmado = resultado?.camposConfirmados?.gasto === true;
    const presupuesto = numeroONulo(campana?.presupuesto) || 0;
    const base = {
      id: campana?.id,
      nombre: campana?.nombre || "Campaña sin nombre",
      gasto,
      venta,
      presupuesto,
    };

    if (gastoConfirmado && gasto > 0 && ventaConfirmada && (venta || 0) <= 0) {
      pausar.push({ ...base, motivo: "Tiene gasto comprobado y venta confirmada en cero." });
    } else if ((presupuesto > 0 || (gasto || 0) > 0) && (!gastoConfirmado || !ventaConfirmada)) {
      medir.push({ ...base, motivo: "Faltan gasto y venta comprobados antes de aumentar presupuesto." });
    } else if (gastoConfirmado && ventaConfirmada && gasto > 0 && venta > gasto * 2) {
      crecer.push({ ...base, retorno: venta / gasto });
    }
  }

  return { activas: activas.length, pausar, medir, crecer };
}

function resumirPagos({ deudas = [], creditos = [], hoy }) {
  const limite7 = sumarDias(hoy, 7);
  const candidatos = [];

  for (const credito of Array.isArray(creditos) ? creditos : []) {
    const monto = numeroONulo(credito?.saldo);
    const fecha = fechaISO(credito?.fecha_vencimiento || credito?.fecha_vencimiento_estimada);
    if (monto === null || monto <= 0 || !fecha) continue;
    candidatos.push({
      tipo: "Proveedor",
      nombre: credito?.nombre || `Proveedor ${credito?.numero_proveedor || ""}`.trim(),
      monto,
      fecha,
      vencido: fecha < hoy,
      proximos7: fecha >= hoy && fecha <= limite7,
    });
  }

  for (const deuda of Array.isArray(deudas) ? deudas : []) {
    const estado = String(deuda?.estado || "").toUpperCase();
    const monto = numeroONulo(deuda?.pago_mensual);
    const fecha = fechaISO(deuda?.fecha_proximo_pago);
    if (!["ACTIVA", "REESTRUCTURADA"].includes(estado) || monto === null || monto <= 0 || !fecha) continue;
    candidatos.push({
      tipo: "Crédito",
      nombre: deuda?.acreedor || deuda?.nombre || "Crédito",
      monto,
      fecha,
      vencido: fecha < hoy,
      proximos7: fecha >= hoy && fecha <= limite7,
    });
  }

  return candidatos
    .filter((pago) => pago.vencido || pago.proximos7)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function resumirCrecimiento(sucursales = []) {
  const validas = (Array.isArray(sucursales) ? sucursales : [])
    .map((sucursal) => ({
      nombre: sucursal?.nombre || sucursal?.name || "Sucursal",
      ventas: numeroONulo(sucursal?.ventasTotales),
    }))
    .filter((sucursal) => sucursal.ventas !== null && sucursal.ventas > 0)
    .sort((a, b) => a.ventas - b.ventas);

  if (!validas.length) return null;
  const menor = validas[0];
  return {
    sucursal: menor.nombre,
    ventasBase: menor.ventas,
    meta10: menor.ventas * 1.1,
    aumento: menor.ventas * 0.1,
    esComparacion: validas.length > 1,
  };
}

export function construirCentroDireccionCEO({
  disponibilidad = null,
  deudas = [],
  deudasConsultadas = false,
  creditosProveedores = {},
  compraMaestra = null,
  compraConsultada = false,
  campanas = [],
  campanasConsultadas = false,
  sucursales = [],
  hoy = new Date().toISOString().slice(0, 10),
} = {}) {
  const resumenDeudas = calcularResumenDeudas(deudas);
  const creditos = Array.isArray(creditosProveedores?.creditos)
    ? creditosProveedores.creditos
    : [];
  const proveedoresCompletos = creditosProveedores?.fuenteCompleta === true;
  const saldoProveedoresIdentificado = creditos.reduce(
    (total, credito) => total + Math.max(0, numeroONulo(credito?.saldo) || 0),
    0,
  );
  const saldoProveedores = proveedoresCompletos ? saldoProveedoresIdentificado : null;
  const deudaIdentificada =
    (deudasConsultadas ? resumenDeudas.saldoTotal : 0) + saldoProveedoresIdentificado;
  const saldosDeudaCompletos = resumenDeudas.sinSaldoActual === 0;
  const deudaCompleta = deudasConsultadas && saldosDeudaCompletos && proveedoresCompletos;
  const pagos = resumirPagos({ deudas, creditos: proveedoresCompletos ? creditos : [], hoy });
  const fechasProveedorIncompletas = proveedoresCompletos && creditos.some((credito) => {
    const saldo = numeroONulo(credito?.saldo);
    return saldo !== null && saldo > 0 && !fechaISO(credito?.fecha_vencimiento || credito?.fecha_vencimiento_estimada);
  });
  const deudasActivas = (Array.isArray(deudas) ? deudas : []).filter((deuda) => ["ACTIVA", "REESTRUCTURADA"].includes(String(deuda?.estado || "").trim().toUpperCase()));
  const fechasDeudaIncompletas = deudasActivas.filter((deuda) => {
    const pago = numeroONulo(deuda?.pago_mensual);
    return pago !== null && pago > 0 && !fechaISO(deuda?.fecha_proximo_pago);
  }).length;
  const calendarioPagosCompleto = deudaCompleta
    && resumenDeudas.sinPagoMensual === 0
    && fechasDeudaIncompletas === 0
    && !fechasProveedorIncompletas;
  const campanasResumen = resumirCampanas(campanasConsultadas ? campanas : []);
  const productosCompra = Array.isArray(compraMaestra?.productos)
    ? compraMaestra.productos
    : [];
  const demandaDisponible = Number(compraMaestra?.fuentes?.productosVendidos || 0) > 0;
  const dineroLibre = disponibilidad?.calculable ? numeroONulo(disponibilidad?.dineroLibre) : null;

  let compra;
  if (!compraConsultada) {
    compra = { estado: "cargando", titulo: "Calculando reposición", detalle: "Revisando ventas e inventario por producto." };
  } else if (!demandaDisponible) {
    compra = {
      estado: "datos",
      titulo: "No autorizar compra todavía",
      detalle: "Falta el reporte Ventas por artículo para comprobar demanda y cantidades.",
    };
  } else if (!productosCompra.length) {
    compra = {
      estado: "bien",
      titulo: "Sin reposición necesaria detectada",
      detalle: "El inventario cubre la demanda observada o puede resolverse con existencias actuales.",
    };
  } else if (dineroLibre === null) {
    compra = {
      estado: "bloqueado",
      titulo: "Plan listo, autorización bloqueada",
      detalle: `${productosCompra.length} productos requieren revisión, pero falta confirmar dinero libre.`,
      piezas: Number(compraMaestra?.totalPiezasComprar || 0),
      inversion: numeroONulo(compraMaestra?.inversionTotal),
      productos: productosCompra.slice(0, 3),
    };
  } else {
    const inversion = numeroONulo(compraMaestra?.inversionTotal) || 0;
    compra = {
      estado: dineroLibre >= inversion ? "revisar" : "limitar",
      titulo: dineroLibre >= inversion ? "Compra con respaldo para revisar" : "Reducir la compra propuesta",
      detalle: dineroLibre >= inversion
        ? "La propuesta cabe en el dinero libre confirmado; Mónica conserva la autorización final."
        : "La reposición propuesta supera el dinero libre confirmado.",
      piezas: Number(compraMaestra?.totalPiezasComprar || 0),
      inversion,
      maximoConCaja: Math.max(0, dineroLibre),
      productos: productosCompra.slice(0, 3),
    };
  }

  let pausar;
  if (!campanasConsultadas) {
    pausar = { estado: "cargando", titulo: "Revisando salidas y campañas", detalle: "Consultando resultados comprobados." };
  } else if (campanasResumen.pausar.length) {
    pausar = {
      estado: "pausar",
      titulo: `Pausar aumento en ${campanasResumen.pausar.length} campaña${campanasResumen.pausar.length === 1 ? "" : "s"}`,
      detalle: "Tienen gasto comprobado sin venta; revisa antes de destinar un peso adicional.",
      elementos: campanasResumen.pausar,
    };
  } else if (campanasResumen.medir.length) {
    pausar = {
      estado: "medir",
      titulo: "No aumentar presupuesto aún",
      detalle: `${campanasResumen.medir.length} campaña${campanasResumen.medir.length === 1 ? " necesita" : "s necesitan"} resultados comprobados.`,
      elementos: campanasResumen.medir,
    };
  } else {
    pausar = {
      estado: "bien",
      titulo: "Sin gasto improductivo comprobado",
      detalle: "MONYS no apagará una actividad sin evidencia. Mantén el control por resultados.",
      elementos: [],
    };
  }

  return {
    dineroLibre,
    deuda: {
      completa: deudaCompleta,
      identificada: deudaIdentificada,
      financiera: deudasConsultadas ? resumenDeudas.saldoTotal : null,
      proveedores: proveedoresCompletos ? saldoProveedores : null,
      creditosActivos: deudasConsultadas ? resumenDeudas.cantidad : null,
      proveedoresConSaldo: creditos.filter((credito) => (numeroONulo(credito?.saldo) || 0) > 0).length,
      fuentesFaltantes: [
        !deudasConsultadas ? "créditos financieros" : null,
        deudasConsultadas && !saldosDeudaCompletos ? "saldos actuales de créditos financieros" : null,
        !proveedoresCompletos ? "saldos de proveedores de todas las sucursales" : null,
      ].filter(Boolean),
    },
    pagos: {
      lista: pagos,
      completo: calendarioPagosCompleto,
      total7Dias: calendarioPagosCompleto ? pagos.reduce((total, pago) => total + pago.monto, 0) : null,
      vencidos: pagos.filter((pago) => pago.vencido).length,
      fechasIncompletas:
        resumenDeudas.sinPagoMensual +
        fechasDeudaIncompletas +
        creditos.filter((credito) => (numeroONulo(credito?.saldo) || 0) > 0 && !fechaISO(credito?.fecha_vencimiento || credito?.fecha_vencimiento_estimada)).length,
    },
    compra,
    pausar,
    crecimiento: resumirCrecimiento(sucursales),
    campanas: campanasResumen,
  };
}

